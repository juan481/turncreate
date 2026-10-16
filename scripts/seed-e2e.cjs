/*
 * Seed para los E2E de Playwright. Corre SOLO contra el Firebase Emulator
 * Suite (Firestore + Auth) -- nunca contra producción. e2e/global-setup.ts
 * lo invoca después de levantar los emuladores y antes de arrancar `next dev`.
 *
 * Requiere FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST,
 * FIREBASE_PROJECT_ID y MP_TOKEN_ENCRYPTION_KEY en el entorno.
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const crypto = require("node:crypto");

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("seed-e2e.cjs sólo corre contra el Emulator Suite (faltan *_EMULATOR_HOST)");
}

const projectId = process.env.FIREBASE_PROJECT_ID || "turncreate-e2e";
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const TENANT_ID = "e2e_nails_tenant";
const SLUG = "e2e-nails";
const TIMEZONE = "America/Argentina/Buenos_Aires";
const OWNER_UID = "e2e_owner_uid";
const OWNER_EMAIL = "e2e-owner@turncreate.test";
const OWNER_PASSWORD = "Testing2026!";
// Playwright corre este spec en 4 proyectos (pixel-7/w320/w360/w390) en
// paralelo contra el mismo backend: cada uno necesita su propio usuario
// "primer ingreso" para no pisarse el cambio de contraseña entre sí.
const NEW_TEMP_PASSWORD = "Temporal2026!";
const PRIMER_INGRESO_PROJECTS = ["pixel-7", "w320", "w360", "w390"];
const primerIngresoEmail = (project) => `e2e-primer-ingreso+${project}@turncreate.test`;
const primerIngresoUid = (project) => `e2e_primer_ingreso_${project}_uid`;
const SELLER_ID = "e2e_seller_id";
const CLIENT_ID = "e2e_client_fixture";
const CLIENT_PHONE = "+5491100000000";

// Mismo envelope que src/server/mercadopago/crypto.ts (AES-256-GCM).
function encryptSecret(value) {
  const raw = process.env.MP_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("Falta MP_TOKEN_ENCRYPTION_KEY");
  const key = crypto.createHash("sha256").update(raw, "utf8").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const envelope = { v: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), data: data.toString("base64url") };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

async function upsertUser({ uid, email, password }) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { password });
  } catch {
    await auth.createUser({ uid, email, password, emailVerified: true });
  }
}

async function main() {
  await upsertUser({ uid: OWNER_UID, email: OWNER_EMAIL, password: OWNER_PASSWORD });
  const primerIngresoUsers = PRIMER_INGRESO_PROJECTS.map((project) => ({
    uid: primerIngresoUid(project), email: primerIngresoEmail(project), password: NEW_TEMP_PASSWORD,
  }));
  for (const user of primerIngresoUsers) await upsertUser(user);

  const tenantRef = db.collection("tenants").doc(TENANT_ID);
  const batch = db.batch();

  batch.set(tenantRef, {
    id: TENANT_ID, name: "E2E Nails", slug: SLUG, businessTypeId: "estetica-unas",
    timezone: TIMEZONE, currency: "ARS", status: "active",
    settings: {
      slotIntervalMin: 15, minNoticeMin: 0, maxBookingDays: 60, booksByStaff: false,
      depositType: "fixed", depositValue: 10000, depositMin: 10000,
      mpFeeMode: "absorbed", mpFeePercent: 0, publicBookingEnabled: true,
    },
    businessHours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opensAt: "00:00", closesAt: "23:45" })),
    updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection("tenantSlugs").doc(SLUG), { tenantId: TENANT_ID, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });

  const allUids = [OWNER_UID, ...primerIngresoUsers.map((u) => u.uid)];
  for (const uid of allUids) {
    batch.set(tenantRef.collection("members").doc(uid), { uid, role: "owner", status: "active", updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
    batch.set(db.collection("users").doc(uid).collection("memberships").doc(TENANT_ID), { tenantId: TENANT_ID, slug: SLUG, role: "owner", status: "active", updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  }
  batch.set(db.collection("users").doc(OWNER_UID), { email: OWNER_EMAIL, fullName: "E2E Owner", mustChangePassword: false, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  for (const user of primerIngresoUsers) {
    batch.set(db.collection("users").doc(user.uid), { email: user.email, fullName: "E2E Primer Ingreso", mustChangePassword: true, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  }

  const categories = [{ id: "manos", name: "Manos", order: 10 }];
  for (const category of categories) {
    batch.set(tenantRef.collection("serviceCategories").doc(category.id), { ...category, tenantId: TENANT_ID, active: true, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
  }
  const services = [
    { id: "manicuria-semipermanente", name: "Manicuría semipermanente", categoryId: "manos", price: 13000, minutes: 45 },
    { id: "manicuria-esmalte-comun", name: "Manicuría con esmalte común", categoryId: "manos", price: 8500, minutes: 35 },
  ];
  for (const svc of services) {
    batch.set(tenantRef.collection("services").doc(svc.id), {
      id: svc.id, tenantId: TENANT_ID, name: svc.name, nameNormalized: svc.name.toLocaleLowerCase("es-AR"),
      description: null, categoryId: svc.categoryId, categoryName: "Manos", price: svc.price,
      phases: [{ kind: "active", minutes: svc.minutes, position: 1 }], bufferAfterMin: 5,
      active: true, public: true, archivedAt: null,
      updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
    });
  }
  batch.set(tenantRef.collection("staff").doc("owner"), {
    id: "owner", tenantId: TENANT_ID, displayName: "E2E Nails", active: true, color: "#7069e8", photoUrl: null,
    serviceIds: services.map((s) => s.id),
    schedules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, starts_at: "00:00", ends_at: "23:45" })),
    commission: null, isOwner: true, autoAssignServices: true, userId: OWNER_UID,
    updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
  });
  // Cliente estable para que las pruebas de navegación no dependan de que
  // otro spec cree uno antes (los cuatro proyectos corren en paralelo).
  batch.set(tenantRef.collection("clients").doc(CLIENT_ID), {
    id: CLIENT_ID, tenantId: TENANT_ID, fullName: "Cliente Fixture",
    fullNameNormalized: "cliente fixture", phoneE164: CLIENT_PHONE,
    email: "cliente-fixture@turncreate.test", photoUrl: null, birthYear: null,
    noShowCount: 0, appointmentsCount: 0, totalSpent: 0,
    lastVisitAt: null, archivedAt: null,
    updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection("tenantClientPhones").doc(`${TENANT_ID}_${CLIENT_PHONE.replace(/[^0-9]/g, "")}`), {
    tenantId: TENANT_ID, clientId: CLIENT_ID, createdAt: FieldValue.serverTimestamp(),
  });

  // Conexión de Mercado Pago "conectada" -- necesaria para que el turnero
  // público habilite reservas. Los tokens no se usan de verdad: el checkout
  // corre con MP_E2E_STUB=1 y nunca llama a la API real de MP.
  batch.set(tenantRef.collection("integrations").doc("mercadopago"), {
    sellerId: SELLER_ID, status: "connected", liveMode: false, publicKey: null,
    accessTokenEncrypted: encryptSecret("e2e-fake-access-token"),
    refreshTokenEncrypted: encryptSecret("e2e-fake-refresh-token"),
    expiresAt: Timestamp.fromMillis(Date.now() + 365 * 24 * 60 * 60 * 1000),
    connectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), lastError: null,
  });
  batch.set(db.collection("mpSellers").doc(SELLER_ID), { tenantId: TENANT_ID, status: "connected", updatedAt: FieldValue.serverTimestamp() });

  await batch.commit();

  // bookingAttempts fijos para probar los 3 desenlaces del checkout sin
  // pegarle a Mercado Pago real (ver e2e/public-booking.spec.ts).
  const now = Timestamp.now();
  const baseAttempt = (status, extra = {}) => ({
    id: "", externalReference: "tc_fixture", tenantId: TENANT_ID, tenantSlug: SLUG, timezone: TIMEZONE,
    holdId: "fixture", status, client: { full_name: "Cliente Fixture", phone_e164: CLIENT_PHONE, email: "" },
    snapshot: { serviceId: services[0].id, serviceName: services[0].name, servicePrice: services[0].price, staffId: "owner", startsAt: now, endsAt: now },
    amounts: { grossAmount: 10000, appliedAmount: 10000, surchargeAmount: 0 },
    expiresAt: now, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  });
  const fixtures = {
    e2e_attempt_approved: baseAttempt("approved", { appointmentToken: "e2e-token-fixture" }),
    e2e_attempt_rejected: baseAttempt("rejected"),
    e2e_attempt_refund_required: baseAttempt("refund_required"),
    e2e_attempt_pending: baseAttempt("pending"),
  };
  const fixtureBatch = db.batch();
  for (const [id, data] of Object.entries(fixtures)) {
    fixtureBatch.set(db.collection("bookingAttempts").doc(id), { ...data, id });
  }
  await fixtureBatch.commit();

  console.log(`Seed E2E OK: tenant ${SLUG}, owner <${OWNER_EMAIL}>, ${primerIngresoUsers.length} usuarios de primer ingreso`);
}

main().catch((error) => {
  console.error("[seed-e2e] falló:", error);
  process.exitCode = 1;
});
