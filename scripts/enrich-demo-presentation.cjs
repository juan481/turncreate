const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { TZDate } = require("@date-fns/tz");
const { format, addDays, subDays } = require("date-fns");

const TIMEZONE = "America/Argentina/Buenos_Aires";
const BATCH = "presentation-2026-10";
const SLOT_MINUTES = 15;

// Fotos curadas a mano (verificadas visualmente, no el `?u=<seed>` de
// pravatar que es un hash sin relación con el género -- así fue como
// Martina/Valentina terminaron con foto de hombre la vez pasada).
const CURATED_PHOTO_BY_NAME = {
  // Barbería Dandy (hombres)
  "Lucas Medina": 7, "Facundo Torres": 8, "Bruno Acosta": 11,
  "Iván Sosa": 12, "Gonzalo Díaz": 13, "Nicolás Vera": 14, "Tomás Ibarra": 3,
  // OSSADA Beauty Studio (mujeres)
  "Camila Ortiz": 16, "Valeria Paz": 19, "Agustina Rey": 20,
  "Milagros Luna": 21, "Rocío Benítez": 23, "Julieta Campos": 25,
  "Florencia Aguirre": 26, "Antonella Ríos": 27,
  // OSSADA Express (mujeres)
  "Delfina Suárez": 29, "Catalina Funes": 30, "Abril Castro": 31,
  "Zoe Navarro": 32, "Pilar Romero": 34, "Josefina Acuña": 35, "Lucía Herrera": 28,
};

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

function at(dateISO, hh, mm) {
  const zoned = new TZDate(`${dateISO}T00:00:00`, TIMEZONE);
  zoned.setHours(hh, mm, 0, 0);
  return new Date(zoned.toISOString());
}

function occupancyId(staffId, instant) {
  return `${staffId}_${instant.toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
}

function slots(startsAt, durationMin) {
  const count = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
  return Array.from({ length: count }, (_, i) => new Date(startsAt.getTime() + i * SLOT_MINUTES * 60_000));
}

function chunk(items, size) {
  const output = [];
  for (let i = 0; i < items.length; i += size) output.push(items.slice(i, i + size));
  return output;
}

async function tenantIdFor(slug) {
  const slugDoc = await db.collection("tenantSlugs").doc(slug).get();
  const id = slugDoc.data()?.tenantId;
  if (typeof id !== "string") throw new Error(`No existe el slug ${slug}`);
  return id;
}

async function enrichTenant(slug) {
  const tenantId = await tenantIdFor(slug);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const [staffSnap, servicesSnap, clientsSnap, generatedSnap] = await Promise.all([
    tenantRef.collection("staff").where("active", "==", true).get(),
    tenantRef.collection("services").where("active", "==", true).get(),
    tenantRef.collection("clients").where("archivedAt", "==", null).get(),
    tenantRef.collection("appointments").where("demoBatch", "==", BATCH).limit(1).get(),
  ]);

  const clients = clientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const clientUpdates = clients.map((client, index) => {
    const curated = CURATED_PHOTO_BY_NAME[client.fullName];
    const photoUrl = curated
      ? `https://i.pravatar.cc/300?img=${curated}`
      : `https://i.pravatar.cc/300?u=turncreate-${slug}-client-${index + 1}`;
    return { ref: tenantRef.collection("clients").doc(client.id), data: { photoUrl, updatedAt: FieldValue.serverTimestamp() } };
  });
  for (const group of chunk(clientUpdates, 400)) {
    const batch = db.batch();
    group.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
  }

  if (!generatedSnap.empty) {
    console.log(`${slug}: fotos actualizadas; el lote ${BATCH} ya existe, no se duplican turnos.`);
    return;
  }

  const services = servicesSnap.docs.map((doc) => {
    const data = doc.data();
    const durationMin = (data.phases ?? []).reduce((sum, phase) => sum + Number(phase.minutes ?? 0), 0) + Number(data.bufferAfterMin ?? 0);
    return { id: doc.id, name: String(data.name), price: Number(data.price), durationMin };
  });
  const staff = staffSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const appointments = [];
  const occupancy = [];
  const payments = [];
  const now = new TZDate(new Date(), TIMEZONE);
  const todayISO = format(now, "yyyy-MM-dd");
  const historicalStart = subDays(now, 180);
  const historicalEnd = subDays(now, 1);

  function addAppointment(staffMember, client, service, dateISO, hh, mm, status) {
    const startsAt = at(dateISO, hh, mm);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
    const ref = tenantRef.collection("appointments").doc();
    const paid = status === "completed" ? service.price : status === "confirmed" && (hh + mm) % 3 === 0 ? Math.round(service.price * 0.3) : 0;
    const method = ["cash", "mercadopago", "transfer"][(hh + mm + service.name.length) % 3];
    appointments.push({ ref, data: {
      id: ref.id, tenantId, staffId: staffMember.id, clientId: client.id,
      clientName: client.fullName, clientPhone: client.phoneE164, clientEmail: client.email || null,
      startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), status,
      total: service.price, balance: Math.max(0, service.price - paid), depositPaid: paid,
      items: [{ serviceId: service.id, name: service.name, price: service.price }],
      rescheduledFromId: null, cancelReason: status === "cancelled" ? "El cliente avisó con anticipación" : null,
      demoBatch: BATCH, createdAt: Timestamp.fromDate(startsAt), updatedAt: Timestamp.fromDate(startsAt),
    }});
    if (status !== "cancelled" && dateISO >= todayISO) {
      for (const instant of slots(startsAt, service.durationMin)) {
        occupancy.push({ ref: tenantRef.collection("occupancy").doc(occupancyId(staffMember.id, instant)), data: { appointmentId: ref.id, tenantId } });
      }
    }
    if (status === "completed" || paid > 0) {
      payments.push({ ref: ref.collection("payments").doc(), data: { amount: status === "completed" ? service.price : paid, method, status: "approved", createdAt: Timestamp.fromDate(startsAt) } });
    }
  }

  let dayIndex = 0;
  for (let cursor = historicalStart; cursor <= historicalEnd; cursor = addDays(cursor, 1)) {
    const dateISO = format(cursor, "yyyy-MM-dd");
    const weekday = new TZDate(`${dateISO}T12:00:00`, TIMEZONE).getDay();
    if (weekday === 0) continue;
    for (let si = 0; si < staff.length; si++) {
      const member = staff[si];
      const eligible = services.filter((service) => (member.serviceIds ?? []).includes(service.id));
      if (!eligible.length) continue;
      const count = weekday === 6 ? 3 : 2;
      for (let n = 0; n < count; n++) {
        const service = eligible[(dayIndex + si + n) % eligible.length];
        const client = clients[(dayIndex * 3 + si + n) % clients.length];
        const hh = 9 + n * 3 + ((si + dayIndex) % 2);
        const mm = n === 0 ? 0 : n === 1 ? 15 : 30;
        const code = (dayIndex + si * 3 + n) % 20;
        addAppointment(member, client, service, dateISO, hh, mm, code === 0 ? "no_show" : code === 1 ? "cancelled" : "completed");
      }
    }
    dayIndex++;
  }

  for (let offset = 4; offset <= 34; offset++) {
    const cursor = addDays(now, offset);
    const dateISO = format(cursor, "yyyy-MM-dd");
    const weekday = new TZDate(`${dateISO}T12:00:00`, TIMEZONE).getDay();
    if (weekday === 0) continue;
    for (let si = 0; si < staff.length; si++) {
      const member = staff[si];
      const eligible = services.filter((service) => (member.serviceIds ?? []).includes(service.id));
      if (!eligible.length) continue;
      const count = weekday === 6 ? 3 : 4;
      for (let n = 0; n < count; n++) {
        const service = eligible[(offset + si + n) % eligible.length];
        const client = clients[(offset * 2 + si + n) % clients.length];
        addAppointment(member, client, service, dateISO, 9 + n * 2, n % 2 === 0 ? 0 : 30, "confirmed");
      }
    }
  }

  for (const group of chunk([...appointments, ...occupancy], 400)) {
    const batch = db.batch();
    group.forEach(({ ref, data }) => batch.set(ref, data, { merge: false }));
    await batch.commit();
  }
  for (const group of chunk(payments, 400)) {
    const batch = db.batch();
    group.forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }

  const stats = new Map(clients.map((client) => [client.id, { count: 0, spent: 0, lastVisitAt: null }]));
  appointments.forEach(({ data }) => {
    if (data.status === "cancelled" || data.status === "no_show") return;
    const stat = stats.get(data.clientId);
    if (!stat) return;
    stat.count += 1;
    if (data.status === "completed") stat.spent += data.total;
    if (!stat.lastVisitAt || data.startsAt.toDate() > stat.lastVisitAt) stat.lastVisitAt = data.startsAt.toDate();
  });
  for (const group of chunk([...stats.entries()], 400)) {
    const batch = db.batch();
    group.forEach(([id, stat]) => batch.update(tenantRef.collection("clients").doc(id), { appointmentsCount: stat.count, totalSpent: stat.spent, lastVisitAt: stat.lastVisitAt ? Timestamp.fromDate(stat.lastVisitAt) : null, updatedAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }

  console.log(`${slug}: +${appointments.length} turnos, ${clients.length} fotos de cliente, ${payments.length} pagos.`);
}

(async () => {
  await enrichTenant("demo-individual");
  await enrichTenant("demo-equipo");
  await enrichTenant("demo-barberia");
  console.log("Presentación demo enriquecida.");
})().catch((error) => { console.error(error); process.exit(1); });
