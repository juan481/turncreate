/*
 * Alta idempotente de las cuentas iniciales de estética/uñas.
 *
 * Dry run:
 *   node scripts/provision-initial-nail-accounts.cjs --dry-run
 * Alta real (las claves nunca se imprimen ni se guardan en el repo):
 *   TURNCREATE_ALISSON_PASSWORD=... TURNCREATE_PONTE_PASSWORD=... TURNCREATE_GENERIC_PASSWORD=... node scripts/provision-initial-nail-accounts.cjs
 */
const { initializeApp, applicationDefault, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

const dryRun = process.argv.includes("--dry-run");
const serviceCredential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") })
  : applicationDefault();
const app = getApps().length ? getApps()[0] : initializeApp({ credential: serviceCredential });
const auth = getAuth(app);
const db = getFirestore(app);
const TIMEZONE = "America/Argentina/Buenos_Aires";
const BUSINESS_HOURS = [1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "09:00", closesAt: "19:00" }));

const ACCOUNTS = [
  { name: "Alisson Nails", email: "alison@turncreate.com.ar", slug: "alisson-nails", passwordEnv: "TURNCREATE_ALISSON_PASSWORD" },
  { name: "Ponte Coquetta STUDIO", email: "pontecoquetta@turncreate.com.ar", slug: "ponte-coquetta-studio", passwordEnv: "TURNCREATE_PONTE_PASSWORD" },
  { name: "Generic Nails Studio", email: "nails.studio@turncreate.com.ar", slug: "generic-nails-studio", passwordEnv: "TURNCREATE_GENERIC_PASSWORD" },
];

const CATEGORIES = [
  { id: "manos", name: "Manos", order: 10 },
  { id: "pies", name: "Pies", order: 20 },
  { id: "esculpidas", name: "Kapping y esculpidas", order: 30 },
];
const SERVICES = [
  ["manicuria-sin-esmalte", "Manicuría sin esmalte", "manos", 6000, 25, 5],
  ["manicuria-esmalte-comun", "Manicuría con esmalte común", "manos", 8500, 35, 5],
  ["manicuria-semipermanente", "Manicuría semipermanente", "manos", 13000, 45, 10],
  ["tratamiento-fortalecedor", "Tratamiento fortalecedor", "manos", 12000, 40, 5],
  ["belleza-pies-sin-esmalte", "Belleza de pies sin esmalte", "pies", 7000, 30, 5],
  ["belleza-pies-esmalte-comun", "Belleza de pies con esmalte común", "pies", 9500, 40, 5],
  ["belleza-pies-semipermanente", "Belleza de pies semipermanente", "pies", 14000, 50, 10],
  ["pedicuria-semipermanente", "Pedicuría semipermanente", "pies", 15500, 55, 10],
  ["kapping-gel-cortas", "Kapping Gel - uñas cortas", "esculpidas", 17000, 60, 10],
  ["kapping-gel-largas", "Kapping Gel - uñas largas", "esculpidas", 21000, 75, 10],
  ["esculpidas-full-set", "Esculpidas Full Set", "esculpidas", 27000, 90, 15],
  ["extension-soft-gel", "Extensión Soft Gel", "esculpidas", 26000, 85, 15],
];

function tenantId(slug) {
  return `nails_${crypto.createHash("sha256").update(slug).digest("hex").slice(0, 20)}`;
}

async function authUser(account) {
  try { return { user: await auth.getUserByEmail(account.email), created: false }; }
  catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    if (dryRun) return { user: { uid: `dry_${account.slug}` }, created: true };
    const password = process.env[account.passwordEnv];
    if (!password || password.length < 10) throw new Error(`Falta ${account.passwordEnv}`);
    return { user: await auth.createUser({ email: account.email, password, displayName: account.name, emailVerified: true }), created: true };
  }
}

async function provision(account) {
  const { user, created: userCreated } = await authUser(account);
  const id = tenantId(account.slug);
  const slugRef = db.collection("tenantSlugs").doc(account.slug);
  const existingSlug = await slugRef.get();
  if (existingSlug.exists && existingSlug.data().tenantId !== id) throw new Error(`El slug ${account.slug} ya pertenece a otra cuenta`);
  if (dryRun) {
    console.log(`[dry-run] ${account.name} <${account.email}> tenant=${id} existente=${existingSlug.exists}`);
    return;
  }
  const tenantRef = db.collection("tenants").doc(id);
  const memberRef = tenantRef.collection("members").doc(user.uid);
  const userRef = db.collection("users").doc(user.uid);
  const membershipRef = userRef.collection("memberships").doc(id);
  const staffRef = tenantRef.collection("staff").doc("owner");
  const categoryRefs = CATEGORIES.map((category) => tenantRef.collection("serviceCategories").doc(category.id));
  const serviceRefs = SERVICES.map(([serviceId]) => tenantRef.collection("services").doc(serviceId));
  const [tenantSnapshot, memberSnapshot, userSnapshot, membershipSnapshot, staffSnapshot, ...catalogSnapshots] = await db.getAll(
    tenantRef,
    memberRef,
    userRef,
    membershipRef,
    staffRef,
    ...categoryRefs,
    ...serviceRefs,
  );
  const categorySnapshots = catalogSnapshots.slice(0, categoryRefs.length);
  const serviceSnapshots = catalogSnapshots.slice(categoryRefs.length);
  const batch = db.batch();
  if (!tenantSnapshot.exists) {
    batch.create(tenantRef, {
      id, name: account.name, slug: account.slug, businessTypeId: "estetica-unas", timezone: TIMEZONE, currency: "ARS", status: "active", plan: "solo", teamMode: "solo",
      settings: { payments: { mercadopagoEnabled: true, transfer: { enabled: false, alias: "", cbu: null, holderName: account.name, bankName: null } }, slotIntervalMin: 15, minNoticeMin: 720, maxBookingDays: 60, booksByStaff: false, depositType: "fixed", depositValue: 10000, depositMin: 10000, mpFeeMode: "absorbed", mpFeePercent: 0, publicBookingEnabled: false },
      businessHours: BUSINESS_HOURS, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.set(slugRef, { tenantId: id, updatedAt: FieldValue.serverTimestamp(), ...(!existingSlug.exists ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
  batch.set(memberRef, { uid: user.uid, role: "owner", status: "active", updatedAt: FieldValue.serverTimestamp(), ...(!memberSnapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
  batch.set(userRef, { email: account.email, fullName: account.name, ...(userCreated ? { mustChangePassword: true } : {}), updatedAt: FieldValue.serverTimestamp(), ...(!userSnapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
  batch.set(membershipRef, { tenantId: id, slug: account.slug, role: "owner", status: "active", updatedAt: FieldValue.serverTimestamp(), ...(!membershipSnapshot.exists ? { createdAt: FieldValue.serverTimestamp() } : {}) }, { merge: true });
  for (const [index, category] of CATEGORIES.entries()) {
    if (!categorySnapshots[index].exists) batch.create(categoryRefs[index], { ...category, tenantId: id, active: true, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  }
  for (const [index, [serviceId, name, categoryId, price, minutes, bufferAfterMin]] of SERVICES.entries()) {
    if (serviceSnapshots[index].exists) continue;
    const categoryName = CATEGORIES.find((category) => category.id === categoryId).name;
    batch.create(serviceRefs[index], { id: serviceId, tenantId: id, name, nameNormalized: name.toLocaleLowerCase("es-AR"), description: null, categoryId, categoryName, price, phases: [{ kind: "active", minutes, position: 1 }], bufferAfterMin, active: true, public: true, sort: index + 1, archivedAt: null, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  }
  if (!staffSnapshot.exists) batch.create(staffRef, { id: "owner", tenantId: id, displayName: account.name, active: true, color: "#7069e8", photoUrl: null, serviceIds: SERVICES.map((service) => service[0]), schedules: BUSINESS_HOURS.map((hours) => ({ weekday: hours.weekday, starts_at: hours.opensAt, ends_at: hours.closesAt })), commission: null, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  await batch.commit();
  console.log(`OK ${account.name} <${account.email}> (${account.slug}) · ${tenantSnapshot.exists ? "cuenta preservada" : "cuenta creada"}`);
}

async function main() {
  for (const account of ACCOUNTS) await provision(account);
  console.log(dryRun ? "Dry run terminado; no se escribió nada." : "Alta terminada. Las reservas públicas siguen bloqueadas hasta conectar Mercado Pago.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
