"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { endTransferWait } from "@/server/public-booking/transfer";

export async function cancelAppointmentAction(token: string, slug: string) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) return;
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return;
  const db = firebaseAdmin().db;
  const result = await db.collectionGroup("appointments").where("token", "==", token).limit(1).get();
  if (result.empty) return;
  const doc = result.docs[0];
  if (doc.data().tenantId !== tenant.id) return;

  let cancelled = false;
  await db.runTransaction(async (transaction) => {
    cancelled = false;
    const fresh = await transaction.get(doc.ref);
    if (!fresh.exists) return;
    const data = fresh.data()!;
    const startsAt = data.startsAt?.toDate?.();
    if (data.tenantId !== tenant.id || !["confirmed", "pending_payment"].includes(String(data.status)) || !(startsAt instanceof Date) || startsAt <= new Date()) return;
    const disposition = Number(data.depositPaid ?? 0) > 0 ? "refund_required" : null;
    transaction.update(doc.ref, {
      status: "cancelled",
      cancelReason: "Cancelado por la clienta",
      cancelSource: "client",
      depositDisposition: disposition,
      // Si esperaba una transferencia, deja de esperarla (no aparece más en la lista de la dueña).
      awaitingTransfer: false,
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
    // Pendiente de transferencia + contador por teléfono, en la misma transacción.
    endTransferWait(transaction, tenant.id, doc.id, data);
    cancelled = true;
  });
  if (cancelled) await releaseAppointmentOccupancy(tenant.id, doc.id);
  revalidatePath(`/${slug}/mi-turno/${token}`);
}
