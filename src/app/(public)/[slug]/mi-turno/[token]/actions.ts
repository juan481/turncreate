"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { endTransferWait } from "@/server/public-booking/transfer";
import { cancellationDepositDisposition, normalizeCancellationRefundHours } from "@/domain/booking/cancellation-policy";
import { refundAppointmentMercadoPagoDeposit, type AutomaticRefundResult } from "@/server/mercadopago/refunds";

export type PublicCancelResult = { ok: true; message: string } | { ok: false; error: string };

export async function cancelAppointmentAction(token: string, slug: string): Promise<PublicCancelResult> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(token)) return { ok: false, error: "El enlace del turno no es válido" };
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return { ok: false, error: "El turno no existe" };
  const db = firebaseAdmin().db;
  const result = await db.collectionGroup("appointments").where("token", "==", token).limit(1).get();
  if (result.empty) return { ok: false, error: "El turno no existe" };
  const doc = result.docs[0];
  if (doc.data().tenantId !== tenant.id) return { ok: false, error: "El turno no existe" };

  let cancelled = false;
  let disposition: "refund_required" | "retained" | null = null;
  await db.runTransaction(async (transaction) => {
    cancelled = false;
    const fresh = await transaction.get(doc.ref);
    if (!fresh.exists) return;
    const data = fresh.data()!;
    const startsAt = data.startsAt?.toDate?.();
    if (data.tenantId !== tenant.id || !["confirmed", "pending_payment"].includes(String(data.status)) || !(startsAt instanceof Date) || startsAt <= new Date()) return;
    disposition = cancellationDepositDisposition({
      depositPaid: Number(data.depositPaid ?? 0),
      startsAt,
      hoursBefore: normalizeCancellationRefundHours(tenant.settings.cancellationRefundHours),
    });
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
  if (!cancelled) return { ok: false, error: "Este turno ya no se puede cancelar desde el enlace" };
  await releaseAppointmentOccupancy(tenant.id, doc.id);
  let automaticRefund: AutomaticRefundResult | null = null;
  if (disposition === "refund_required") {
    try {
      automaticRefund = await refundAppointmentMercadoPagoDeposit(tenant.id, doc.id);
    } catch (error) {
      console.error("[public cancellation] automatic refund failed", tenant.id, doc.id, error);
      await doc.ref.set({ automaticRefundStatus: "failed", automaticRefundError: error instanceof Error ? error.message.slice(0, 200) : "Error desconocido", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  }
  revalidatePath(`/${slug}/mi-turno/${token}`);
  revalidatePath(`/app/${slug}/caja`);
  revalidatePath(`/app/${slug}/reportes`);
  if (disposition === "retained") return { ok: true, message: "Turno cancelado. Como fue fuera del plazo, la seña no se devuelve." };
  if (automaticRefund === "refunded") return { ok: true, message: "Turno cancelado. La devolución de Mercado Pago ya fue solicitada." };
  if (disposition === "refund_required") return { ok: true, message: "Turno cancelado. La seña quedó registrada para devolución." };
  return { ok: true, message: "Turno cancelado." };
}
