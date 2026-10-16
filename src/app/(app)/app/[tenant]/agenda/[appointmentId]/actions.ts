"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { paymentDocument, type PaymentMethod } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
import { clearPendingTransfer } from "@/server/public-booking/transfer";

export type ChangeStatusState = { error: string | null };
const RELEASES_OCCUPANCY = new Set(["cancelled", "no_show"]);
const ALLOWED: Record<string, string[]> = { pending_payment: ["confirmed", "cancelled"], confirmed: ["completed", "no_show", "cancelled"] };
const METHODS = new Set<PaymentMethod>(["cash", "transfer", "card_posnet", "mercadopago"]);

export async function changeStatus(slug: string, appointmentId: string, dateISO: string, _prev: ChangeStatusState, formData: FormData): Promise<ChangeStatusState> {
  const status = formData.get("toStatus");
  if (typeof status !== "string") return { error: "Falta el estado destino" };
  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "No autorizado" };
  try {
    const { tenant } = await requireTenantAccess(user.uid, slug);
    const db = firebaseAdmin().db;
    const tenantRef = db.collection("tenants").doc(tenant.id);
    const appointmentRef = tenantRef.collection("appointments").doc(appointmentId);
    const requestedAmount = Number(formData.get("amount") ?? 0);
    const requestedMethod = String(formData.get("method") ?? "") as PaymentMethod;
    const openCash = requestedMethod === "cash"
      ? await tenantRef.collection("cashSessions").where("closedAt", "==", null).limit(1).get()
      : null;
    const openCashSessionId = openCash?.docs[0]?.id ?? null;
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appointmentRef);
      if (!snapshot.exists) throw new Error("El turno no existe");
      const data = snapshot.data()!;
      if (!(ALLOWED[String(data.status)] ?? []).includes(status)) throw new Error("Ese cambio de estado no está permitido");
      const update: Record<string, unknown> = { status, cancelReason: String(formData.get("reason") || "") || null, updatedAt: FieldValue.serverTimestamp() };
      if (status === "cancelled" && Number(data.depositPaid ?? 0) > 0) {
        const disposition = String(formData.get("depositDisposition") ?? "");
        if (!new Set(["retained", "refund_required", "credit"]).has(disposition)) throw new Error("Elegí qué hacer con la seña");
        update.depositDisposition = disposition;
      }
      if (data.status === "pending_payment" && status === "confirmed") {
        if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !METHODS.has(requestedMethod)) throw new Error("Ingresá monto y medio de pago");
        const currentBalance = Number(data.balance ?? data.total ?? requestedAmount);
        if (requestedAmount > currentBalance + 0.01) throw new Error("El monto supera el saldo pendiente");
        const applied = requestedAmount;
        const paymentRef = appointmentRef.collection("payments").doc();
        transaction.create(paymentRef, paymentDocument({ id: paymentRef.id, kind: Number(data.depositPaid ?? 0) > 0 ? "balance" : "deposit", method: requestedMethod, status: "approved", grossAmount: requestedAmount, appliedAmount: applied, feeAmount: 0, surchargeAmount: 0, netAmount: requestedAmount, paidAt: new Date(), source: "admin", tenantId: tenant.id, appointmentId }));
        if (data.clientId) transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(applied), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        update.balance = Math.max(0, currentBalance - applied);
        if (Number(data.depositPaid ?? 0) === 0) update.depositPaid = applied;
        if (requestedMethod === "cash" && openCashSessionId) {
          const movementRef = tenantRef.collection("cashSessions").doc(openCashSessionId).collection("movements").doc();
          transaction.create(movementRef, { id: movementRef.id, type: "in", amount: requestedAmount, method: "cash", reason: `Cobro turno · ${String(data.clientName ?? "")}`.trim(), appointmentId, createdAt: FieldValue.serverTimestamp() });
        }
        if (data.awaitingTransfer === true) {
          update.awaitingTransfer = false;
          update.transferConfirmedAt = FieldValue.serverTimestamp();
          update.transferConfirmedBy = user.uid;
        }
      }
      transaction.update(appointmentRef, update);
      if (data.clientId && status === "no_show") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { noShowCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (data.clientId && status === "completed") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { lastVisitAt: data.startsAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const historyRef = appointmentRef.collection("statusHistory").doc();
      transaction.create(historyRef, { id: historyRef.id, from: data.status, to: status, reason: update.cancelReason, depositDisposition: update.depositDisposition ?? null, changedBy: user.uid, createdAt: FieldValue.serverTimestamp() });
    });
    if (status === "confirmed" || status === "cancelled") await clearPendingTransfer(tenant.id, appointmentId);
    if (RELEASES_OCCUPANCY.has(status)) await releaseAppointmentOccupancy(tenant.id, appointmentId);
    revalidatePath(`/app/${slug}/agenda`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el turno" };
  }
  redirect(`/app/${slug}/agenda?date=${dateISO}`);
}
