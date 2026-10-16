import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { reconcileMercadoPagoPayment } from "@/server/mercadopago/checkout";
import { expirePendingTransfers } from "@/server/public-booking/transfer";

// Libera holds vencidos (10 min), cancela los turnos cuya seña por
// transferencia no se confirmó a tiempo y reintenta webhooks de MP.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = firebaseAdmin().db;
  const now = Timestamp.now();
  const expired = await db.collectionGroup("holds").where("expiresAt", "<", now).limit(100).get();
  let released = 0;
  for (const snapshot of expired.docs) {
    const hold = snapshot.data();
    const tenantRef = snapshot.ref.parent.parent;
    if (!tenantRef) continue;
    await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(snapshot.ref);
      if (!latest.exists || latest.data()!.expiresAt.toMillis() >= Date.now()) return;
      const duration = Math.round((hold.endsAt.toDate().getTime() - hold.startsAt.toDate().getTime()) / 60_000);
      const occupancyRefs = occupancySlotInstants(hold.startsAt.toDate(), duration).map((instant) =>
        tenantRef.collection("occupancy").doc(occupancyDocId(String(hold.staffId), instant)),
      );
      const occupancy = await transaction.getAll(...occupancyRefs);
      occupancy.forEach((slot) => {
        if (slot.data()?.holdId === snapshot.id) transaction.delete(slot.ref);
      });
      transaction.delete(snapshot.ref);
      released += 1;
    });
  }

  let transfersExpired = 0;
  try {
    transfersExpired = await expirePendingTransfers();
  } catch (error) {
    console.error("[cron/holds] no se pudieron vencer las transferencias pendientes", error);
  }

  const queued = await db.collection("mpWebhookEvents").where("processedAt", "==", null).limit(50).get();
  let reconciled = 0;
  for (const event of queued.docs) {
    const paymentId = event.data().paymentId;
    if (!paymentId || Number(event.data().attempts ?? 0) >= 10 || (event.data().processingUntil?.toMillis?.() ?? 0) > Date.now()) continue;
    try {
      await event.ref.set({ attempts: FieldValue.increment(1), lastAttemptAt: FieldValue.serverTimestamp() }, { merge: true });
      await reconcileMercadoPagoPayment(String(paymentId));
      reconciled += 1;
    } catch (error) {
      await event.ref.set({ lastError: error instanceof Error ? error.message.slice(0, 300) : "Error desconocido" }, { merge: true });
    }
  }
  return NextResponse.json({ ok: true, released, transfersExpired, reconciled }, { status: 200 });
}
