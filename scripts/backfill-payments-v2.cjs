/* Backfill compatible e idempotente del esquema PaymentRecord. */
const { initializeApp, applicationDefault, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const dryRun = process.argv.includes("--dry-run");
const credential = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
  ? cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") })
  : applicationDefault();
const app = getApps().length ? getApps()[0] : initializeApp({ credential });
const db = getFirestore(app);

async function main() {
  const tenants = await db.collection("tenants").get();
  let inspected = 0;
  let updated = 0;
  for (const tenant of tenants.docs) {
    const appointments = await tenant.ref.collection("appointments").get();
    for (const appointment of appointments.docs) {
      const payments = await appointment.ref.collection("payments").get();
      for (const payment of payments.docs) {
        inspected += 1;
        const data = payment.data();
        if (data.schemaVersion === 2 && data.tenantId === tenant.id && data.appointmentId === appointment.id) continue;
        const amount = Number(data.appliedAmount ?? data.amount ?? 0);
        const paidAt = data.paidAt ?? data.createdAt ?? Timestamp.now();
        const patch = {
          schemaVersion: 2,
          tenantId: tenant.id,
          appointmentId: appointment.id,
          kind: data.kind ?? (Number(appointment.data().depositPaid ?? 0) > 0 ? "deposit" : "balance"),
          method: data.method ?? "cash",
          status: data.status ?? "approved",
          amount,
          grossAmount: Number(data.grossAmount ?? amount),
          appliedAmount: amount,
          feeAmount: Number(data.feeAmount ?? 0),
          surchargeAmount: Number(data.surchargeAmount ?? 0),
          netAmount: Number(data.netAmount ?? amount),
          paidAt,
          source: data.source ?? "migration",
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (!dryRun) await payment.ref.set(patch, { merge: true });
        updated += 1;
      }
    }
  }
  console.log(`${dryRun ? "[dry-run] " : ""}${inspected} pagos revisados; ${updated} requieren/recibieron backfill.`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
