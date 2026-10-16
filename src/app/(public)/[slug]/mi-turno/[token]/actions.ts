"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { clearPendingTransfer } from "@/server/public-booking/transfer";

export async function cancelAppointmentAction(token: string, slug: string) {
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return;
  const db = firebaseAdmin().db;
  const result = await db.collectionGroup("appointments").where("token", "==", token).limit(1).get();
  if (result.empty) return;
  const doc = result.docs[0];
  if (doc.data().tenantId !== tenant.id) return;

  let cancelled = false;
  await db.runTransaction(async (transaction) => {
    const fresh = await transaction.get(doc.ref);
    if (!fresh.exists) return;
    const data = fresh.data()!;
    const startsAt = data.startsAt?.toDate?.();
    if (data.tenantId !== tenant.id || !["confirmed", "pending_payment"].includes(String(data.status)) || !(startsAt instanceof Date) || startsAt <= new Date()) return;
    const disposition = Number(data.depositPaid ?? 0) > 0 ? "refund_required" : null;
    transaction.update(doc.ref, {
      status: "cancelled",
      cancelReason: "Cancelado por la clienta",
      depositDisposition: disposition,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const historyRef = doc.ref.collection("statusHistory").doc();
    transaction.create(historyRef, {
      id: historyRef.id,
      from: data.status,
      to: "cancelled",
      reason: "Cancelado por la clienta",
      depositDisposition: disposition,
      changedBy: "public_token",
      createdAt: FieldValue.serverTimestamp(),
    });
    cancelled = true;
  });
  if (cancelled) {
    await Promise.all([
      releaseAppointmentOccupancy(tenant.id, doc.id),
      clearPendingTransfer(tenant.id, doc.id),
    ]);
  }
  revalidatePath(`/${slug}/mi-turno/${token}`);
}
