/**
 * Crea datos de demostración: un usuario de prueba con 2 locales (uno
 * individual, uno de equipo con varios profesionales), cada uno con
 * servicios, clientes y una agenda llena de turnos en distintos estados.
 *
 * Uso:
 *   GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/firebase-admin-<proyecto>.json" \
 *     node scripts/seed-demo-data.cjs
 *
 * Es re-ejecutable: si el usuario o los slugs ya existen, los reutiliza
 * en vez de fallar (no duplica nada), pero no borra turnos ya creados en
 * una corrida anterior -- para arrancar de cero hay que borrar a mano los
 * tenants/usuario en la consola de Firebase primero.
 */
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { TZDate } = require("@date-fns/tz");
const { format, addDays } = require("date-fns");

const TIMEZONE = "America/Argentina/Buenos_Aires";
const DEMO_EMAIL = "demoturn@turncreate.com.ar";
const DEMO_PASSWORD = "demo1234";

const app = getApps().length ? getApps()[0] : initializeApp({ credential: applicationDefault() });
const auth = getAuth(app);
const db = getFirestore(app);
const FV = FieldValue;

const SLOT_MINUTES = 15;
function occupancyDocId(staffId, instant) {
  return `${staffId}_${instant.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
}
function occupancySlotInstants(startsAt, durationMin) {
  const count = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
  return Array.from({ length: count }, (_, i) => new Date(startsAt.getTime() + i * SLOT_MINUTES * 60_000));
}
function at(dateISO, hh, mm) {
  const zoned = new TZDate(`${dateISO}T00:00:00`, TIMEZONE);
  zoned.setHours(hh, mm, 0, 0);
  return new Date(zoned.toISOString());
}

async function ensureDemoUser() {
  try {
    const user = await auth.getUserByEmail(DEMO_EMAIL);
    console.log(`Usuario demo ya existía (${user.uid})`);
    return user.uid;
  } catch {
    const user = await auth.createUser({ email: DEMO_EMAIL, password: DEMO_PASSWORD, displayName: "Usuario Demo" });
    await db.collection("users").doc(user.uid).set({
      email: DEMO_EMAIL,
      fullName: "Usuario Demo",
      createdAt: FV.serverTimestamp(),
      updatedAt: FV.serverTimestamp(),
    });
    console.log(`Usuario demo creado (${user.uid})`);
    return user.uid;
  }
}

async function ensureTenant(ownerUid, { name, slug, businessTypeId, businessHours }) {
  const slugRef = db.collection("tenantSlugs").doc(slug);
  const existing = await slugRef.get();
  if (existing.exists) {
    const tenantId = existing.data().tenantId;
    console.log(`Tenant "${slug}" ya existía (${tenantId}) -- no se re-seedea`);
    return { tenantId, created: false };
  }

  const tenantRef = db.collection("tenants").doc();
  const memberRef = tenantRef.collection("members").doc(ownerUid);
  const userMembershipRef = db.collection("users").doc(ownerUid).collection("memberships").doc(tenantRef.id);

  await db.runTransaction(async (tx) => {
    tx.create(tenantRef, {
      id: tenantRef.id,
      name,
      slug,
      businessTypeId,
      timezone: TIMEZONE,
      status: "active",
      settings: { slotIntervalMin: 15, minNoticeMin: 60, booksByStaff: true, depositType: "none", depositValue: 0, depositMin: 0 },
      businessHours,
      createdAt: FV.serverTimestamp(),
    });
    tx.create(slugRef, { tenantId: tenantRef.id, createdAt: FV.serverTimestamp() });
    tx.create(memberRef, { uid: ownerUid, role: "owner", status: "active", createdAt: FV.serverTimestamp() });
    tx.set(userMembershipRef, { tenantId: tenantRef.id, slug, role: "owner", status: "active", createdAt: FV.serverTimestamp() }, { merge: true });
  });

  console.log(`Tenant "${slug}" creado (${tenantRef.id})`);
  return { tenantId: tenantRef.id, created: true };
}

async function createStaff(tenantId, { displayName, color, serviceIds, photoUrl }) {
  const ref = db.collection("tenants").doc(tenantId).collection("staff").doc();
  await ref.set({
    id: ref.id, tenantId, displayName, active: true, color, photoUrl: photoUrl ?? null,
    serviceIds, schedules: [], commission: null,
    createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
  });
  return ref.id;
}

async function createService(tenantId, { name, price, bufferAfterMin, minutes }) {
  const ref = db.collection("tenants").doc(tenantId).collection("services").doc();
  await ref.set({
    id: ref.id, tenantId, name, price, bufferAfterMin,
    phases: [{ kind: "active", minutes, position: 1 }],
    active: true, sort: Date.now(), archivedAt: null,
    createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
  });
  return { id: ref.id, name, price, durationMin: minutes + bufferAfterMin };
}

async function createClient(tenantId, { fullName, phoneE164, email }) {
  const clientRef = db.collection("tenants").doc(tenantId).collection("clients").doc();
  const phoneRef = db.collection("tenantClientPhones").doc(`${tenantId}_${phoneE164.replace(/[^0-9]/g, "")}`);
  await db.runTransaction(async (tx) => {
    tx.create(clientRef, {
      id: clientRef.id, tenantId, fullName, fullNameNormalized: fullName.toLocaleLowerCase("es-AR"),
      phoneE164, email: email || null, noShowCount: 0, appointmentsCount: 0, totalSpent: 0,
      lastVisitAt: null, archivedAt: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
    });
    tx.create(phoneRef, { tenantId, clientId: clientRef.id, createdAt: FV.serverTimestamp() });
  });
  return clientRef.id;
}

async function createAppointment(tenantId, { staffId, client, service, startsAt, status, depositPaid = 0, paymentMethod }) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const apptRef = tenantRef.collection("appointments").doc();
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const balance = status === "completed" ? 0 : Math.max(0, service.price - depositPaid);

  await apptRef.set({
    id: apptRef.id, tenantId, staffId, clientId: client.id, clientName: client.fullName,
    clientPhone: client.phoneE164, clientEmail: client.email || null,
    startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt),
    status, total: service.price, balance, depositPaid,
    items: [{ serviceId: service.id, name: service.name, price: service.price }],
    rescheduledFromId: null,
    cancelReason: status === "cancelled" ? "El cliente avisó que no podía venir" : null,
    createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp(),
  });

  if (status !== "cancelled") {
    const batch = db.batch();
    for (const instant of occupancySlotInstants(startsAt, service.durationMin)) {
      batch.set(tenantRef.collection("occupancy").doc(occupancyDocId(staffId, instant)), { appointmentId: apptRef.id, tenantId });
    }
    await batch.commit();
  }

  if (status === "completed") {
    await apptRef.collection("payments").doc().set({ amount: service.price, method: paymentMethod || "cash", status: "approved", createdAt: Timestamp.now() });
  } else if (depositPaid > 0) {
    await apptRef.collection("payments").doc().set({ amount: depositPaid, method: paymentMethod || "cash", status: "approved", createdAt: Timestamp.now() });
  }
}

const BUSINESS_HOURS_LUN_SAB = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "09:00", closesAt: "19:00" }));

async function seedIndividual(ownerUid, dates) {
  const { tenantId, created } = await ensureTenant(ownerUid, {
    name: "Barbería Demo Solo",
    slug: "demo-individual",
    businessTypeId: "barberia",
    businessHours: BUSINESS_HOURS_LUN_SAB,
  });
  if (!created) return;

  const corte = await createService(tenantId, { name: "Corte clásico", price: 8000, bufferAfterMin: 5, minutes: 30 });
  const corteBarba = await createService(tenantId, { name: "Corte + Barba", price: 12000, bufferAfterMin: 10, minutes: 45 });
  const afeitado = await createService(tenantId, { name: "Afeitado clásico", price: 6000, bufferAfterMin: 5, minutes: 20 });

  const staffId = await createStaff(tenantId, { displayName: "Tomás Ibarra", color: "#7069E8", serviceIds: [corte.id, corteBarba.id, afeitado.id], photoUrl: "https://i.pravatar.cc/300?u=turncreate-demo-tomas" });

  const clientNames = [
    ["Lucas Medina", "+5491122330001"],
    ["Facundo Torres", "+5491122330002"],
    ["Bruno Acosta", "+5491122330003"],
    ["Iván Sosa", "+5491122330004"],
    ["Gonzalo Díaz", "+5491122330005"],
    ["Nicolás Vera", "+5491122330006"],
  ];
  const clients = [];
  for (const [fullName, phoneE164] of clientNames) {
    clients.push({ id: await createClient(tenantId, { fullName, phoneE164 }), fullName, phoneE164 });
  }
  const c = (i) => clients[i % clients.length];

  const [today, tomorrow, dayAfter] = dates;
  const plan = [
    { d: today, hh: 9, mm: 0, service: corte, status: "completed", method: "cash" },
    { d: today, hh: 10, mm: 0, service: corteBarba, status: "completed", method: "mercadopago" },
    { d: today, hh: 11, mm: 30, service: afeitado, status: "completed", method: "cash" },
    { d: today, hh: 14, mm: 0, service: corte, status: "confirmed" },
    { d: today, hh: 15, mm: 0, service: corteBarba, status: "confirmed", depositPaid: 3000, method: "cash" },
    { d: today, hh: 16, mm: 30, service: afeitado, status: "cancelled" },
    { d: today, hh: 17, mm: 0, service: corte, status: "confirmed" },
    { d: tomorrow, hh: 10, mm: 0, service: corteBarba, status: "confirmed" },
    { d: tomorrow, hh: 12, mm: 0, service: afeitado, status: "confirmed" },
    { d: dayAfter, hh: 11, mm: 0, service: corte, status: "confirmed" },
  ];

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    await createAppointment(tenantId, {
      staffId, client: c(i), service: p.service, startsAt: at(p.d, p.hh, p.mm),
      status: p.status, depositPaid: p.depositPaid || 0, paymentMethod: p.method,
    });
  }
  console.log(`Local individual "${slugLabel("demo-individual")}": 1 profesional, 3 servicios, ${clients.length} clientes, ${plan.length} turnos`);
}

async function seedEquipo(ownerUid, dates) {
  const { tenantId, created } = await ensureTenant(ownerUid, {
    name: "Estudio Demo Equipo",
    slug: "demo-equipo",
    businessTypeId: "peluqueria",
    businessHours: BUSINESS_HOURS_LUN_SAB,
  });
  if (!created) return;

  const corteS = await createService(tenantId, { name: "Corte", price: 9000, bufferAfterMin: 5, minutes: 40 });
  const color = await createService(tenantId, { name: "Color", price: 25000, bufferAfterMin: 15, minutes: 90 });
  const brushing = await createService(tenantId, { name: "Brushing", price: 7000, bufferAfterMin: 5, minutes: 30 });
  const tratamiento = await createService(tenantId, { name: "Tratamiento capilar", price: 15000, bufferAfterMin: 10, minutes: 60 });

  const valentinaId = await createStaff(tenantId, { displayName: "Valentina Gómez", color: "#EC4899", serviceIds: [corteS.id, color.id, brushing.id, tratamiento.id], photoUrl: "https://i.pravatar.cc/300?u=turncreate-demo-valentina" });
  const martinaId = await createStaff(tenantId, { displayName: "Martina Ruiz", color: "#22C55E", serviceIds: [corteS.id, brushing.id], photoUrl: "https://i.pravatar.cc/300?u=turncreate-demo-martina" });
  const sofiaId = await createStaff(tenantId, { displayName: "Sofía Fernández", color: "#F59E0B", serviceIds: [corteS.id, color.id, tratamiento.id], photoUrl: "https://i.pravatar.cc/300?u=turncreate-demo-sofia" });

  const clientNames = [
    ["Camila Ortiz", "+5491122340001"],
    ["Valeria Paz", "+5491122340002"],
    ["Agustina Rey", "+5491122340003"],
    ["Milagros Luna", "+5491122340004"],
    ["Rocío Benítez", "+5491122340005"],
    ["Julieta Campos", "+5491122340006"],
    ["Florencia Aguirre", "+5491122340007"],
    ["Antonella Ríos", "+5491122340008"],
  ];
  const clients = [];
  for (const [fullName, phoneE164] of clientNames) {
    clients.push({ id: await createClient(tenantId, { fullName, phoneE164 }), fullName, phoneE164 });
  }
  const c = (i) => clients[i % clients.length];

  const [today, tomorrow, dayAfter] = dates;
  const plan = [
    { staffId: valentinaId, d: today, hh: 9, mm: 0, service: color, status: "completed", method: "mercadopago" },
    { staffId: valentinaId, d: today, hh: 11, mm: 0, service: corteS, status: "completed", method: "cash" },
    { staffId: valentinaId, d: today, hh: 12, mm: 0, service: tratamiento, status: "completed", method: "transfer" },
    { staffId: valentinaId, d: today, hh: 14, mm: 0, service: brushing, status: "confirmed" },
    { staffId: valentinaId, d: today, hh: 15, mm: 0, service: color, status: "confirmed", depositPaid: 5000, method: "cash" },
    { staffId: valentinaId, d: tomorrow, hh: 10, mm: 0, service: corteS, status: "confirmed" },
    { staffId: valentinaId, d: dayAfter, hh: 11, mm: 0, service: tratamiento, status: "confirmed" },

    { staffId: martinaId, d: today, hh: 9, mm: 30, service: corteS, status: "completed", method: "cash" },
    { staffId: martinaId, d: today, hh: 10, mm: 30, service: brushing, status: "completed", method: "mercadopago" },
    { staffId: martinaId, d: today, hh: 13, mm: 0, service: corteS, status: "confirmed" },
    { staffId: martinaId, d: today, hh: 14, mm: 0, service: brushing, status: "confirmed" },
    { staffId: martinaId, d: tomorrow, hh: 11, mm: 0, service: corteS, status: "confirmed" },
    { staffId: martinaId, d: tomorrow, hh: 15, mm: 0, service: brushing, status: "cancelled" },

    { staffId: sofiaId, d: today, hh: 9, mm: 0, service: tratamiento, status: "completed", method: "cash" },
    { staffId: sofiaId, d: today, hh: 10, mm: 30, service: corteS, status: "completed", method: "cash" },
    { staffId: sofiaId, d: today, hh: 12, mm: 0, service: color, status: "completed", method: "mercadopago" },
    { staffId: sofiaId, d: today, hh: 15, mm: 0, service: color, status: "confirmed" },
    { staffId: sofiaId, d: dayAfter, hh: 10, mm: 0, service: corteS, status: "confirmed" },
  ];

  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    await createAppointment(tenantId, {
      staffId: p.staffId, client: c(i), service: p.service, startsAt: at(p.d, p.hh, p.mm),
      status: p.status, depositPaid: p.depositPaid || 0, paymentMethod: p.method,
    });
  }
  console.log(`Local de equipo "${slugLabel("demo-equipo")}": 3 profesionales, 4 servicios, ${clients.length} clientes, ${plan.length} turnos`);
}

function slugLabel(slug) {
  return slug;
}

async function main() {
  const now = new TZDate(new Date(), TIMEZONE);
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  const dayAfter = format(addDays(now, 2), "yyyy-MM-dd");
  const dates = [today, tomorrow, dayAfter];

  const ownerUid = await ensureDemoUser();
  await seedIndividual(ownerUid, dates);
  await seedEquipo(ownerUid, dates);

  console.log("\nListo. Login de prueba:");
  console.log(`  email: ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
