/**
 * Reestructura el demo a 3 locales coherentes:
 *  - demo-individual -> "OSSADA Express" (estética, 1 profesional mujer, clientas mujeres)
 *  - demo-equipo      -> "OSSADA Beauty Studio" (estética, 3 profesionales mujeres, ya estaba bien -- solo se le pone nombre+logo de marca)
 *  - demo-barberia     -> NUEVO "Barbería Dandy" (barbería, 1 profesional hombre, clientes hombres)
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS="<ruta>" node rebuild-3-tenants.cjs
 */
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { TZDate } = require("@date-fns/tz");
const { format, addDays } = require("date-fns");

const TIMEZONE = "America/Argentina/Buenos_Aires";
const app = getApps().length ? getApps()[0] : initializeApp({ credential: applicationDefault() });
const db = getFirestore(app);
const FV = FieldValue;
const DEMO_EMAIL = "demoturn@turncreate.com.ar";

const PHOTO = (n) => `https://i.pravatar.cc/300?img=${n}`;
const OSSADA_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KICA8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjEwMCIgZmlsbD0iIzIxMTgxNCIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iOTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0M5QTI0QiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8dGV4dCB4PSIxMDAiIHk9IjExMiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsICdUaW1lcyBOZXcgUm9tYW4nLCBzZXJpZiIgZm9udC1zaXplPSI1NiIgZmlsbD0iI0M5QTI0QiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+TzwvdGV4dD4KICA8dGV4dCB4PSIxMDAiIHk9IjE0MiIgZm9udC1mYW1pbHk9Ikdlb3JnaWEsIHNlcmlmIiBmb250LXNpemU9IjE0IiBmaWxsPSIjRUZFNkQzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iNSI+T1NTQURBPC90ZXh0Pgo8L3N2Zz4K";
const DANDY_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KICA8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjEwMCIgZmlsbD0iIzE1MjUzNiIvPgogIDxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iOTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0M5QTI0QiIgc3Ryb2tlLXdpZHRoPSIxLjUiLz4KICA8Y2lyY2xlIGN4PSIxMDAiIGN5PSIxMDAiIHI9IjgyIiBmaWxsPSJub25lIiBzdHJva2U9IiNDOUEyNEIiIHN0cm9rZS13aWR0aD0iMC43NSIvPgogIDx0ZXh0IHg9IjEwMCIgeT0iMTEyIiBmb250LWZhbWlseT0iR2VvcmdpYSwgJ1RpbWVzIE5ldyBSb21hbicsIHNlcmlmIiBmb250LXNpemU9IjUyIiBmaWxsPSIjRjJFRkVBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5EPC90ZXh0PgogIDx0ZXh0IHg9IjEwMCIgeT0iMTQwIiBmb250LWZhbWlseT0iR2VvcmdpYSwgc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiNDOUEyNEIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSIzIj5CQVJCRVLDjUE8L3RleHQ+Cjwvc3ZnPgo=";

const SLOT_MINUTES = 15;
function occupancyDocId(staffId, instant) { return `${staffId}_${instant.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`; }
function occupancySlotInstants(startsAt, durationMin) { const count = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES)); return Array.from({ length: count }, (_, i) => new Date(startsAt.getTime() + i * SLOT_MINUTES * 60_000)); }
function at(dateISO, hh, mm) { const zoned = new TZDate(`${dateISO}T00:00:00`, TIMEZONE); zoned.setHours(hh, mm, 0, 0); return new Date(zoned.toISOString()); }

async function wipeCollection(ref) {
  const snap = await ref.get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
  return snap.size;
}

async function createService(tenantId, { name, price, bufferAfterMin, minutes }) {
  const ref = db.collection("tenants").doc(tenantId).collection("services").doc();
  await ref.set({ id: ref.id, tenantId, name, price, bufferAfterMin, phases: [{ kind: "active", minutes, position: 1 }], active: true, sort: Date.now(), archivedAt: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
  return { id: ref.id, name, price, durationMin: minutes + bufferAfterMin };
}
async function createStaff(tenantId, { displayName, color, serviceIds, photoUrl }) {
  const ref = db.collection("tenants").doc(tenantId).collection("staff").doc();
  await ref.set({ id: ref.id, tenantId, displayName, active: true, color, photoUrl: photoUrl ?? null, serviceIds, schedules: [], commission: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
  return ref.id;
}
async function createClient(tenantId, { fullName, phoneE164, photoUrl }) {
  const clientRef = db.collection("tenants").doc(tenantId).collection("clients").doc();
  const phoneRef = db.collection("tenantClientPhones").doc(`${tenantId}_${phoneE164.replace(/[^0-9]/g, "")}`);
  await db.runTransaction(async (tx) => {
    tx.create(clientRef, { id: clientRef.id, tenantId, fullName, fullNameNormalized: fullName.toLocaleLowerCase("es-AR"), phoneE164, email: null, photoUrl: photoUrl ?? null, noShowCount: 0, appointmentsCount: 0, totalSpent: 0, lastVisitAt: null, archivedAt: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
    tx.create(phoneRef, { tenantId, clientId: clientRef.id, createdAt: FV.serverTimestamp() });
  });
  return { id: clientRef.id, fullName, phoneE164 };
}
async function createAppointment(tenantId, { staffId, client, service, startsAt, status, depositPaid = 0, paymentMethod }) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const apptRef = tenantRef.collection("appointments").doc();
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const balance = status === "completed" ? 0 : Math.max(0, service.price - depositPaid);
  await apptRef.set({ id: apptRef.id, tenantId, staffId, clientId: client.id, clientName: client.fullName, clientPhone: client.phoneE164, clientEmail: null, startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), status, total: service.price, balance, depositPaid, items: [{ serviceId: service.id, name: service.name, price: service.price }], rescheduledFromId: null, cancelReason: status === "cancelled" ? "El cliente avisó que no podía venir" : null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
  if (status !== "cancelled") {
    const batch = db.batch();
    for (const instant of occupancySlotInstants(startsAt, service.durationMin)) batch.set(tenantRef.collection("occupancy").doc(occupancyDocId(staffId, instant)), { appointmentId: apptRef.id, tenantId });
    await batch.commit();
  }
  if (status === "completed") await apptRef.collection("payments").doc().set({ amount: service.price, method: paymentMethod || "cash", status: "approved", createdAt: Timestamp.now() });
  else if (depositPaid > 0) await apptRef.collection("payments").doc().set({ amount: depositPaid, method: paymentMethod || "cash", status: "approved", createdAt: Timestamp.now() });
}

const BUSINESS_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "09:00", closesAt: "19:00" }));

// Subset de uñas del catálogo estética completo (igual al que ya atiende
// Valentina en el equipo) -- una sucursal chica/express no hace skin care,
// cejas/pestañas ni micropigmentación, requieren especialista aparte.
const NAIL_CATALOG = [
  ["Manicuría sin esmalte", 25, 6000, 5], ["Manicuría con esmalte común OPI", 35, 8500, 5],
  ["Manicuría Infinite Shine OPI", 40, 11000, 5], ["Manicuría semipermanente", 45, 13000, 10],
  ["Tratamiento fortalecedor OPI", 40, 12000, 5], ["Manicuría para caballeros", 30, 8000, 5],
  ["Manicuría kids", 25, 6000, 5], ["Cambio de esmalte", 15, 4000, 5], ["Cambio de esmalte por uña", 5, 1000, 0],
  ["Belleza de pies sin esmalte", 30, 7000, 5], ["Belleza de pies con esmalte común", 40, 9500, 5],
  ["Belleza de pies Infinite Shine OPI", 45, 12000, 5], ["Belleza de pies semipermanente", 50, 14000, 10],
  ["Belleza de pies con Kapping", 60, 18000, 10], ["Belleza de pies para caballeros", 35, 8500, 5],
  ["Pedicuría sin esmalte", 35, 8000, 5], ["Pedicuría con esmalte común OPI", 45, 10500, 5],
  ["Pedicuría Infinite Shine OPI", 50, 13000, 5], ["Pedicuría semipermanente", 55, 15500, 10],
  ["Pedicuría con Kapping Gel", 65, 19500, 10], ["Pedicuría Estética Premium", 75, 24000, 15],
  ["Kapping Gel - uñas cortas", 60, 17000, 10], ["Kapping Gel - uñas largas", 75, 21000, 10],
  ["Kapping acrílico - Técnica dipping", 70, 20000, 10], ["Kapping Polygel", 75, 22000, 10],
  ["Kapping Gel Baby Boomer", 80, 24000, 15], ["Una uña Kapping", 15, 3500, 0], ["Parche para uña", 10, 2500, 0],
  ["Esculpidas Full Set", 90, 27000, 15], ["Esculpidas Baby Boomer", 95, 29000, 15],
  ["Extensión Soft Gel", 85, 26000, 15], ["Service de esculpidas", 60, 16000, 10],
  ["Service Soft Gel", 55, 15000, 10], ["Una uña esculpida", 15, 3500, 0], ["Una uña esculpida del pie", 15, 3800, 0],
  ["Cat Eye / Chrome / Jelly", 20, 5500, 5], ["Francesas o medialuna", 20, 5000, 5],
  ["Diseño en todas las uñas", 30, 8000, 5], ["Diseño premium en todas las uñas", 40, 11000, 5],
];

const BARBERIA_CATALOG = [
  ["Corte clásico", 30, 8000, 5], ["Corte + Barba", 45, 12000, 10], ["Afeitado clásico", 20, 6000, 5],
  ["Perfilado de barba", 20, 5500, 5], ["Corte a máquina", 20, 6500, 5],
];

async function tenantIdForSlug(slug) {
  const slugDoc = await db.collection("tenantSlugs").doc(slug).get();
  return slugDoc.exists ? slugDoc.data().tenantId : null;
}

async function fullWipeTenant(tenantId) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const clientsSnap = await tenantRef.collection("clients").get();
  for (const doc of clientsSnap.docs) {
    const phone = String(doc.data().phoneE164 || "").replace(/[^0-9]/g, "");
    if (phone) await db.collection("tenantClientPhones").doc(`${tenantId}_${phone}`).delete().catch(() => {});
  }
  const n1 = await wipeCollection(tenantRef.collection("services"));
  const n2 = await wipeCollection(tenantRef.collection("staff"));
  const n3 = await wipeCollection(tenantRef.collection("clients"));
  const n4 = await wipeCollection(tenantRef.collection("appointments"));
  const n5 = await wipeCollection(tenantRef.collection("occupancy"));
  console.log(`  borrado: ${n1} servicios, ${n2} staff, ${n3} clientes, ${n4} turnos, ${n5} ocupación`);
}

async function main() {
  const now = new TZDate(new Date(), TIMEZONE);
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  const dayAfter = format(addDays(now, 2), "yyyy-MM-dd");

  // === 1. demo-individual -> OSSADA Express (reconstrucción total) ===
  console.log("=== demo-individual -> OSSADA Express ===");
  const expressId = await tenantIdForSlug("demo-individual");
  if (!expressId) throw new Error("demo-individual no existe");
  await fullWipeTenant(expressId);
  await db.collection("tenants").doc(expressId).update({ name: "OSSADA Express", businessTypeId: "cosmiatria", logoUrl: OSSADA_LOGO, updatedAt: FV.serverTimestamp() });

  const expressServices = {};
  for (const [name, minutes, price, bufferAfterMin] of NAIL_CATALOG) expressServices[name] = await createService(expressId, { name, price, bufferAfterMin, minutes });
  const luciaId = await createStaff(expressId, { displayName: "Lucía Herrera", color: "#C9A24B", serviceIds: Object.values(expressServices).map((s) => s.id), photoUrl: PHOTO(28) });

  const expressClients = {};
  for (const [name, phone, img] of [["Delfina Suárez", "+5491122350001", 29], ["Catalina Funes", "+5491122350002", 30], ["Abril Castro", "+5491122350003", 31], ["Zoe Navarro", "+5491122350004", 32], ["Pilar Romero", "+5491122350005", 34], ["Josefina Acuña", "+5491122350006", 35]]) {
    expressClients[name] = await createClient(expressId, { fullName: name, phoneE164: phone, photoUrl: PHOTO(img) });
  }
  const ec = Object.values(expressClients);
  const planExpress = [
    { hh: 9, mm: 0, s: "Manicuría semipermanente", status: "completed", method: "cash" },
    { hh: 10, mm: 0, s: "Pedicuría con Kapping Gel", status: "completed", method: "mercadopago" },
    { hh: 11, mm: 30, s: "Esculpidas Full Set", status: "completed", method: "transfer" },
    { hh: 14, mm: 0, s: "Manicuría con esmalte común OPI", status: "confirmed" },
    { hh: 15, mm: 0, s: "Kapping Gel - uñas largas", status: "confirmed", deposit: 6000, method: "cash" },
    { hh: 17, mm: 0, s: "Cambio de esmalte", status: "cancelled" },
    { d: tomorrow, hh: 10, mm: 0, s: "Belleza de pies semipermanente", status: "confirmed" },
    { d: tomorrow, hh: 12, mm: 0, s: "Diseño premium en todas las uñas", status: "confirmed" },
    { d: dayAfter, hh: 11, mm: 0, s: "Service de esculpidas", status: "confirmed" },
  ];
  for (let i = 0; i < planExpress.length; i++) {
    const p = planExpress[i];
    await createAppointment(expressId, { staffId: luciaId, client: ec[i % ec.length], service: expressServices[p.s], startsAt: at(p.d || today, p.hh, p.mm), status: p.status, depositPaid: p.deposit || 0, paymentMethod: p.method });
  }
  console.log(`  OSSADA Express: 1 profesional, ${Object.keys(expressServices).length} servicios, ${ec.length} clientas, ${planExpress.length} turnos`);

  // === 2. demo-equipo -> solo nombre + logo (ya estaba bien: estética, 3 mujeres) ===
  console.log("=== demo-equipo -> OSSADA Beauty Studio (solo rebranding) ===");
  const studioId = await tenantIdForSlug("demo-equipo");
  if (!studioId) throw new Error("demo-equipo no existe");
  await db.collection("tenants").doc(studioId).update({ name: "OSSADA Beauty Studio", logoUrl: OSSADA_LOGO, updatedAt: FV.serverTimestamp() });
  console.log("  renombrado + logo aplicado");

  // === 3. demo-barberia -> NUEVO tenant, Tomás + clientes hombres reubicados ===
  console.log("=== demo-barberia -> Barbería Dandy (nuevo) ===");
  const existingSlug = await tenantIdForSlug("demo-barberia");
  let dandyId = existingSlug;
  if (!dandyId) {
    const userSnap = await db.collection("users").where("email", "==", DEMO_EMAIL).limit(1).get();
    let ownerUid = userSnap.docs[0]?.id;
    if (!ownerUid) {
      const { getAuth } = require("firebase-admin/auth");
      const user = await getAuth(app).getUserByEmail(DEMO_EMAIL);
      ownerUid = user.uid;
    }
    const tenantRef = db.collection("tenants").doc();
    const slugRef = db.collection("tenantSlugs").doc("demo-barberia");
    const memberRef = tenantRef.collection("members").doc(ownerUid);
    const userMembershipRef = db.collection("users").doc(ownerUid).collection("memberships").doc(tenantRef.id);
    await db.runTransaction(async (tx) => {
      tx.create(tenantRef, { id: tenantRef.id, name: "Barbería Dandy", slug: "demo-barberia", businessTypeId: "barberia", timezone: TIMEZONE, status: "active", logoUrl: DANDY_LOGO, settings: { slotIntervalMin: 15, minNoticeMin: 60, booksByStaff: true, depositType: "none", depositValue: 0, depositMin: 0 }, businessHours: BUSINESS_HOURS, createdAt: FV.serverTimestamp() });
      tx.create(slugRef, { tenantId: tenantRef.id, createdAt: FV.serverTimestamp() });
      tx.create(memberRef, { uid: ownerUid, role: "owner", status: "active", createdAt: FV.serverTimestamp() });
      tx.set(userMembershipRef, { tenantId: tenantRef.id, slug: "demo-barberia", role: "owner", status: "active", createdAt: FV.serverTimestamp() }, { merge: true });
    });
    dandyId = tenantRef.id;
    console.log(`  tenant creado (${dandyId})`);
  } else {
    await fullWipeTenant(dandyId);
    await db.collection("tenants").doc(dandyId).update({ name: "Barbería Dandy", logoUrl: DANDY_LOGO, updatedAt: FV.serverTimestamp() });
  }

  const dandyServices = {};
  for (const [name, minutes, price, bufferAfterMin] of BARBERIA_CATALOG) dandyServices[name] = await createService(dandyId, { name, price, bufferAfterMin, minutes });
  const tomasId = await createStaff(dandyId, { displayName: "Tomás Ibarra", color: "#152536", serviceIds: Object.values(dandyServices).map((s) => s.id), photoUrl: PHOTO(3) });

  const dandyClients = {};
  for (const [name, phone, img] of [["Lucas Medina", "+5491122330001", 7], ["Facundo Torres", "+5491122330002", 8], ["Bruno Acosta", "+5491122330003", 11], ["Iván Sosa", "+5491122330004", 12], ["Gonzalo Díaz", "+5491122330005", 13], ["Nicolás Vera", "+5491122330006", 14]]) {
    dandyClients[name] = await createClient(dandyId, { fullName: name, phoneE164: phone, photoUrl: PHOTO(img) });
  }
  const dc = Object.values(dandyClients);
  const planDandy = [
    { hh: 9, mm: 0, s: "Corte clásico", status: "completed", method: "cash" },
    { hh: 10, mm: 0, s: "Corte + Barba", status: "completed", method: "mercadopago" },
    { hh: 11, mm: 30, s: "Afeitado clásico", status: "completed", method: "cash" },
    { hh: 14, mm: 0, s: "Corte clásico", status: "confirmed" },
    { hh: 15, mm: 0, s: "Corte + Barba", status: "confirmed", deposit: 3000, method: "cash" },
    { hh: 16, mm: 30, s: "Perfilado de barba", status: "cancelled" },
    { hh: 17, mm: 0, s: "Corte a máquina", status: "confirmed" },
    { d: tomorrow, hh: 10, mm: 0, s: "Corte + Barba", status: "confirmed" },
    { d: tomorrow, hh: 12, mm: 0, s: "Afeitado clásico", status: "confirmed" },
    { d: dayAfter, hh: 11, mm: 0, s: "Corte clásico", status: "confirmed" },
  ];
  for (let i = 0; i < planDandy.length; i++) {
    const p = planDandy[i];
    await createAppointment(dandyId, { staffId: tomasId, client: dc[i % dc.length], service: dandyServices[p.s], startsAt: at(p.d || today, p.hh, p.mm), status: p.status, depositPaid: p.deposit || 0, paymentMethod: p.method });
  }
  console.log(`  Barbería Dandy: 1 profesional, ${Object.keys(dandyServices).length} servicios, ${dc.length} clientes, ${planDandy.length} turnos`);

  console.log("\nListo. 3 locales: OSSADA Express (demo-individual), OSSADA Beauty Studio (demo-equipo), Barbería Dandy (demo-barberia).");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
