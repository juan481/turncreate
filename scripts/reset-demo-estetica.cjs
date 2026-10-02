/**
 * Convierte los 2 tenants demo (demo-individual, demo-equipo) a rubro
 * estética (uñas/pestañas/cejas/skin care), reemplazando el catálogo de
 * servicios de barbería/peluquería por el pedido por el cliente. Borra
 * servicios, turnos y ocupación viejos; crea el catálogo nuevo completo,
 * reparte servicios entre el staff y genera una agenda nueva.
 *
 * Uso: GOOGLE_APPLICATION_CREDENTIALS="<ruta al json>" node reset-demo-estetica.cjs
 */
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { TZDate } = require("@date-fns/tz");
const { format, addDays } = require("date-fns");

const TIMEZONE = "America/Argentina/Buenos_Aires";
const app = getApps().length ? getApps()[0] : initializeApp({ credential: applicationDefault() });
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

// [categoria, nombre, minutos, precio, bufferAfterMin]
const CATALOG = [
  // Manicuría
  ["manicuria", "Manicuría sin esmalte", 25, 6000, 5],
  ["manicuria", "Manicuría con esmalte común OPI", 35, 8500, 5],
  ["manicuria", "Manicuría Infinite Shine OPI", 40, 11000, 5],
  ["manicuria", "Manicuría semipermanente", 45, 13000, 10],
  ["manicuria", "Tratamiento fortalecedor OPI", 40, 12000, 5],
  ["manicuria", "Manicuría para caballeros", 30, 8000, 5],
  ["manicuria", "Manicuría kids", 25, 6000, 5],
  ["manicuria", "Cambio de esmalte", 15, 4000, 5],
  ["manicuria", "Cambio de esmalte por uña", 5, 1000, 0],
  // Belleza de pies
  ["pies", "Belleza de pies sin esmalte", 30, 7000, 5],
  ["pies", "Belleza de pies con esmalte común", 40, 9500, 5],
  ["pies", "Belleza de pies Infinite Shine OPI", 45, 12000, 5],
  ["pies", "Belleza de pies semipermanente", 50, 14000, 10],
  ["pies", "Belleza de pies con Kapping", 60, 18000, 10],
  ["pies", "Belleza de pies para caballeros", 35, 8500, 5],
  // Pedicuría estética
  ["pedicuria", "Pedicuría sin esmalte", 35, 8000, 5],
  ["pedicuria", "Pedicuría con esmalte común OPI", 45, 10500, 5],
  ["pedicuria", "Pedicuría Infinite Shine OPI", 50, 13000, 5],
  ["pedicuria", "Pedicuría semipermanente", 55, 15500, 10],
  ["pedicuria", "Pedicuría con Kapping Gel", 65, 19500, 10],
  ["pedicuria", "Pedicuría Estética Premium", 75, 24000, 15],
  // Kapping
  ["kapping", "Kapping Gel - uñas cortas", 60, 17000, 10],
  ["kapping", "Kapping Gel - uñas largas", 75, 21000, 10],
  ["kapping", "Kapping acrílico - Técnica dipping", 70, 20000, 10],
  ["kapping", "Kapping Polygel", 75, 22000, 10],
  ["kapping", "Kapping Gel Baby Boomer", 80, 24000, 15],
  ["kapping", "Una uña Kapping", 15, 3500, 0],
  ["kapping", "Parche para uña", 10, 2500, 0],
  // Uñas esculpidas y soft gel
  ["esculpidas", "Esculpidas Full Set", 90, 27000, 15],
  ["esculpidas", "Esculpidas Baby Boomer", 95, 29000, 15],
  ["esculpidas", "Extensión Soft Gel", 85, 26000, 15],
  ["esculpidas", "Service de esculpidas", 60, 16000, 10],
  ["esculpidas", "Service Soft Gel", 55, 15000, 10],
  ["esculpidas", "Una uña esculpida", 15, 3500, 0],
  ["esculpidas", "Una uña esculpida del pie", 15, 3800, 0],
  // Nail art
  ["nailart", "Cat Eye / Chrome / Jelly", 20, 5500, 5],
  ["nailart", "Francesas o medialuna", 20, 5000, 5],
  ["nailart", "Diseño en todas las uñas", 30, 8000, 5],
  ["nailart", "Diseño premium en todas las uñas", 40, 11000, 5],
  // Cejas
  ["cejas", "Perfilado de cejas", 20, 5000, 5],
  ["cejas", "Perfilado de cejas + Henna", 30, 7500, 5],
  ["cejas", "Laminado de cejas", 35, 9000, 5],
  ["cejas", "Laminado de cejas + Tinte", 45, 11500, 10],
  ["cejas", "Laminado de cejas + Perfilado", 45, 11000, 10],
  ["cejas", "Aplicación de Henna", 20, 5500, 5],
  ["cejas", "Hidratación de cejas", 20, 5000, 5],
  // Pestañas
  ["pestanas", "Lifting tradicional", 45, 10000, 10],
  ["pestanas", "Lifting técnica coreana", 50, 12500, 10],
  ["pestanas", "Lifting tradicional + Tinte", 55, 12500, 10],
  ["pestanas", "Lifting coreano + Tinte", 60, 15000, 10],
  ["pestanas", "Tinte de pestañas", 20, 5000, 5],
  ["pestanas", "Hidratación de pestañas", 20, 5500, 5],
  // Extensiones de pestañas
  ["extensiones", "Clásicas 1D", 100, 22000, 15],
  ["extensiones", "3D tecnológicas", 110, 27000, 15],
  ["extensiones", "5D tecnológicas", 120, 32000, 15],
  ["extensiones", "Efecto Rímel", 100, 24000, 15],
  ["extensiones", "Service clásicas", 60, 14000, 10],
  ["extensiones", "Service 3D / 5D / Efecto Rímel", 70, 17000, 10],
  ["extensiones", "Medio retiro", 30, 7000, 5],
  ["extensiones", "Remoción completa", 30, 6000, 5],
  // Micropigmentación
  ["micropigmentacion", "Microblading de cejas", 120, 55000, 15],
  ["micropigmentacion", "Micropigmentación de labios", 120, 60000, 15],
  // Skin care - tratamientos faciales
  ["skincare", "Limpieza facial profunda", 60, 16000, 10],
  ["skincare", "Limpieza + Dermaplaning", 70, 20000, 10],
  ["skincare", "Limpieza + Microneedling Glow", 75, 26000, 15],
  ["skincare", "Limpieza + Peeling", 70, 22000, 10],
  ["skincare", "Exosomas", 75, 38000, 15],
  ["skincare", "Hidralips", 45, 24000, 10],
  ["skincare", "Microneedling - sesión individual", 60, 25000, 10],
  ["skincare", "Microneedling - pack 4", 60, 88000, 10],
  ["skincare", "Microneedling - pack 6", 60, 126000, 10],
  ["skincare", "Peeling - sesión", 45, 18000, 10],
  ["skincare", "Peeling - pack 3", 45, 48000, 10],
  ["skincare", "Peeling - pack 5", 45, 76000, 10],
  // Depilación facial
  ["depilacion", "Bozo", 10, 3000, 0],
  ["depilacion", "Mentón", 10, 3000, 0],
  ["depilacion", "Barbilla", 10, 3000, 0],
  ["depilacion", "Frente", 10, 3000, 0],
  // Experiencias OSSADA
  ["ossada", "Pack Basic: Manicuría + Pedicuría con esmaltado común OPI", 75, 17500, 10],
  ["ossada", "Pack Golden: Manicuría + Pedicuría con esmalte semipermanente", 90, 25500, 15],
  ["ossada", "Pack Teen: Manos y pies con OPI común, para niñas de hasta 13 años", 60, 13500, 10],
  ["ossada", "Promo Caballeros: Manicuría y pedicuría para hombres", 60, 15500, 10],
  ["ossada", "Promo Belleza Doble: Lifting de pestañas + laminado de cejas", 75, 19000, 10],
];

const CATS = {
  valentina: ["manicuria", "pies", "pedicuria", "kapping", "esculpidas", "nailart"],
  martina: ["cejas", "pestanas", "extensiones", "micropigmentacion"],
  sofia: ["skincare", "depilacion"],
};
// Packs OSSADA repartidos: los 4 de manos/pies para Valentina, el de pestañas+cejas para Martina.
const OSSADA_VALENTINA = [
  "Pack Basic: Manicuría + Pedicuría con esmaltado común OPI",
  "Pack Golden: Manicuría + Pedicuría con esmalte semipermanente",
  "Pack Teen: Manos y pies con OPI común, para niñas de hasta 13 años",
  "Promo Caballeros: Manicuría y pedicuría para hombres",
];
const OSSADA_MARTINA = ["Promo Belleza Doble: Lifting de pestañas + laminado de cejas"];

async function wipeCollection(ref) {
  const snap = await ref.get();
  const batchSize = 400;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + batchSize)) batch.delete(doc.ref);
    await batch.commit();
  }
  return snap.size;
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

async function resetTenant(slug, { staffPlan }) {
  const slugDoc = await db.collection("tenantSlugs").doc(slug).get();
  if (!slugDoc.exists) throw new Error(`Tenant ${slug} no existe`);
  const tenantId = slugDoc.data().tenantId;
  const tenantRef = db.collection("tenants").doc(tenantId);

  console.log(`\n=== ${slug} (${tenantId}) ===`);
  const delServices = await wipeCollection(tenantRef.collection("services"));
  const delAppointments = await wipeCollection(tenantRef.collection("appointments"));
  const delOccupancy = await wipeCollection(tenantRef.collection("occupancy"));
  console.log(`Borrados: ${delServices} servicios, ${delAppointments} turnos, ${delOccupancy} docs de ocupación`);

  await tenantRef.update({ businessTypeId: "cosmiatria", updatedAt: FV.serverTimestamp() });

  const services = {};
  for (const [cat, name, minutes, price, bufferAfterMin] of CATALOG) {
    const svc = await createService(tenantId, { name, price, bufferAfterMin, minutes });
    services[name] = { ...svc, cat };
  }
  console.log(`Catálogo nuevo: ${Object.keys(services).length} servicios`);

  const staffSnap = await tenantRef.collection("staff").get();
  for (const doc of staffSnap.docs) {
    const key = staffPlan.byName[doc.data().displayName];
    if (!key) continue;
    const cats = CATS[key] ?? [];
    let ids = Object.values(services).filter((s) => cats.includes(s.cat)).map((s) => s.id);
    if (key === "valentina") ids = ids.concat(OSSADA_VALENTINA.map((n) => services[n].id));
    if (key === "martina") ids = ids.concat(OSSADA_MARTINA.map((n) => services[n].id));
    if (staffPlan.allServices) ids = Object.values(services).map((s) => s.id);
    await doc.ref.update({ serviceIds: ids, updatedAt: FV.serverTimestamp() });
    console.log(`  staff ${doc.data().displayName}: ${ids.length} servicios`);
  }

  return { tenantId, services, staff: staffSnap.docs.map((d) => ({ id: d.id, name: d.data().displayName })) };
}

async function main() {
  const now = new TZDate(new Date(), TIMEZONE);
  const today = format(now, "yyyy-MM-dd");
  const tomorrow = format(addDays(now, 1), "yyyy-MM-dd");
  const dayAfter = format(addDays(now, 2), "yyyy-MM-dd");

  // --- demo-individual: Tomás Ibarra, todo el catálogo ---
  const individual = await resetTenant("demo-individual", { staffPlan: { byName: { "Tomás Ibarra": "valentina" }, allServices: true } });
  const staffTomas = individual.staff[0].id;
  const svcI = individual.services;
  const clientsI = [
    ["Lucas Medina", "+5491122330001"], ["Facundo Torres", "+5491122330002"], ["Bruno Acosta", "+5491122330003"],
    ["Iván Sosa", "+5491122330004"], ["Gonzalo Díaz", "+5491122330005"], ["Nicolás Vera", "+5491122330006"],
  ];
  const ciIds = [];
  for (const [fullName, phoneE164] of clientsI) {
    const ref = db.collection("tenants").doc(individual.tenantId).collection("clients").doc();
    ciIds.push({ id: ref.id, fullName, phoneE164 });
  }
  // reusar clientes si ya existen (no los borramos), si no, crearlos
  const existingClientsI = await db.collection("tenants").doc(individual.tenantId).collection("clients").get();
  const cI = existingClientsI.empty
    ? await (async () => {
        const out = [];
        for (const [fullName, phoneE164] of clientsI) {
          const ref = db.collection("tenants").doc(individual.tenantId).collection("clients").doc();
          await ref.set({ id: ref.id, tenantId: individual.tenantId, fullName, fullNameNormalized: fullName.toLocaleLowerCase("es-AR"), phoneE164, email: null, noShowCount: 0, appointmentsCount: 0, totalSpent: 0, lastVisitAt: null, archivedAt: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
          out.push({ id: ref.id, fullName, phoneE164 });
        }
        return out;
      })()
    : existingClientsI.docs.map((d) => ({ id: d.id, fullName: d.data().fullName, phoneE164: d.data().phoneE164 }));
  const pick = (arr, i) => arr[i % arr.length];

  const planI = [
    { d: today, hh: 9, mm: 0, s: "Manicuría semipermanente", status: "completed", method: "cash" },
    { d: today, hh: 10, mm: 0, s: "Pedicuría con Kapping Gel", status: "completed", method: "mercadopago" },
    { d: today, hh: 11, mm: 30, s: "Laminado de cejas + Tinte", status: "completed", method: "cash" },
    { d: today, hh: 13, mm: 0, s: "Limpieza facial profunda", status: "completed", method: "transfer" },
    { d: today, hh: 14, mm: 30, s: "Lifting tradicional", status: "confirmed" },
    { d: today, hh: 15, mm: 30, s: "Kapping Gel - uñas largas", status: "confirmed", deposit: 6000, method: "cash" },
    { d: today, hh: 17, mm: 0, s: "Cambio de esmalte", status: "cancelled" },
    { d: tomorrow, hh: 10, mm: 0, s: "Clásicas 1D", status: "confirmed" },
    { d: tomorrow, hh: 12, mm: 0, s: "Pack Golden: Manicuría + Pedicuría con esmalte semipermanente", status: "confirmed" },
    { d: dayAfter, hh: 11, mm: 0, s: "Microblading de cejas", status: "confirmed" },
  ];
  for (let i = 0; i < planI.length; i++) {
    const p = planI[i];
    await createAppointment(individual.tenantId, { staffId: staffTomas, client: pick(cI, i), service: svcI[p.s], startsAt: at(p.d, p.hh, p.mm), status: p.status, depositPaid: p.deposit || 0, paymentMethod: p.method });
  }
  console.log(`demo-individual: ${planI.length} turnos nuevos`);

  // --- demo-equipo: Valentina / Martina / Sofía, repartidas por especialidad ---
  const equipo = await resetTenant("demo-equipo", { staffPlan: { byName: { "Valentina Gómez": "valentina", "Martina Ruiz": "martina", "Sofía Fernández": "sofia" } } });
  const byName = Object.fromEntries(equipo.staff.map((s) => [s.name, s.id]));
  const svcE = equipo.services;
  const existingClientsE = await db.collection("tenants").doc(equipo.tenantId).collection("clients").get();
  const clientsE = [
    ["Camila Ortiz", "+5491122340001"], ["Valeria Paz", "+5491122340002"], ["Agustina Rey", "+5491122340003"],
    ["Milagros Luna", "+5491122340004"], ["Rocío Benítez", "+5491122340005"], ["Julieta Campos", "+5491122340006"],
    ["Florencia Aguirre", "+5491122340007"], ["Antonella Ríos", "+5491122340008"],
  ];
  const cE = existingClientsE.empty
    ? await (async () => {
        const out = [];
        for (const [fullName, phoneE164] of clientsE) {
          const ref = db.collection("tenants").doc(equipo.tenantId).collection("clients").doc();
          await ref.set({ id: ref.id, tenantId: equipo.tenantId, fullName, fullNameNormalized: fullName.toLocaleLowerCase("es-AR"), phoneE164, email: null, noShowCount: 0, appointmentsCount: 0, totalSpent: 0, lastVisitAt: null, archivedAt: null, createdAt: FV.serverTimestamp(), updatedAt: FV.serverTimestamp() });
          out.push({ id: ref.id, fullName, phoneE164 });
        }
        return out;
      })()
    : existingClientsE.docs.map((d) => ({ id: d.id, fullName: d.data().fullName, phoneE164: d.data().phoneE164 }));

  const planE = [
    { staff: "Valentina Gómez", d: today, hh: 9, mm: 0, s: "Kapping Gel - uñas largas", status: "completed", method: "mercadopago" },
    { staff: "Valentina Gómez", d: today, hh: 10, mm: 30, s: "Pedicuría semipermanente", status: "completed", method: "cash" },
    { staff: "Valentina Gómez", d: today, hh: 11, mm: 30, s: "Esculpidas Full Set", status: "completed", method: "transfer" },
    { staff: "Valentina Gómez", d: today, hh: 14, mm: 0, s: "Manicuría semipermanente", status: "confirmed" },
    { staff: "Valentina Gómez", d: today, hh: 15, mm: 0, s: "Pack Golden: Manicuría + Pedicuría con esmalte semipermanente", status: "confirmed", deposit: 8000, method: "cash" },
    { staff: "Valentina Gómez", d: tomorrow, hh: 10, mm: 0, s: "Diseño premium en todas las uñas", status: "confirmed" },
    { staff: "Valentina Gómez", d: dayAfter, hh: 11, mm: 0, s: "Belleza de pies con Kapping", status: "confirmed" },

    { staff: "Martina Ruiz", d: today, hh: 9, mm: 30, s: "Perfilado de cejas + Henna", status: "completed", method: "cash" },
    { staff: "Martina Ruiz", d: today, hh: 10, mm: 30, s: "Lifting técnica coreana", status: "completed", method: "mercadopago" },
    { staff: "Martina Ruiz", d: today, hh: 13, mm: 0, s: "3D tecnológicas", status: "confirmed" },
    { staff: "Martina Ruiz", d: today, hh: 15, mm: 0, s: "Microblading de cejas", status: "confirmed" },
    { staff: "Martina Ruiz", d: tomorrow, hh: 11, mm: 0, s: "Laminado de cejas", status: "confirmed" },
    { staff: "Martina Ruiz", d: tomorrow, hh: 15, mm: 0, s: "Promo Belleza Doble: Lifting de pestañas + laminado de cejas", status: "cancelled" },

    { staff: "Sofía Fernández", d: today, hh: 9, mm: 0, s: "Limpieza + Microneedling Glow", status: "completed", method: "cash" },
    { staff: "Sofía Fernández", d: today, hh: 10, mm: 30, s: "Bozo", status: "completed", method: "cash" },
    { staff: "Sofía Fernández", d: today, hh: 11, mm: 15, s: "Peeling - sesión", status: "completed", method: "mercadopago" },
    { staff: "Sofía Fernández", d: today, hh: 15, mm: 0, s: "Exosomas", status: "confirmed" },
    { staff: "Sofía Fernández", d: dayAfter, hh: 10, mm: 0, s: "Hidralips", status: "confirmed" },
  ];
  for (let i = 0; i < planE.length; i++) {
    const p = planE[i];
    await createAppointment(equipo.tenantId, { staffId: byName[p.staff], client: cE[i % cE.length], service: svcE[p.s], startsAt: at(p.d, p.hh, p.mm), status: p.status, depositPaid: p.deposit || 0, paymentMethod: p.method });
  }
  console.log(`demo-equipo: ${planE.length} turnos nuevos`);

  console.log("\nListo.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
