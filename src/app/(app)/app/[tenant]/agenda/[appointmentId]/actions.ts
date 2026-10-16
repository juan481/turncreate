"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { paymentDocument, roundMoney, type PaymentMethod } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
import { isRefundDue } from "@/server/firebase/stats-model";
import { endTransferWait } from "@/server/public-booking/transfer";

export type ChangeStatusState = { error: string | null };
const RELEASES_OCCUPANCY = new Set(["cancelled", "no_show"]);
const ALLOWED: Record<string, string[]> = { pending_payment: ["confirmed", "cancelled"], confirmed: ["completed", "no_show", "cancelled"] };
const METHODS = new Set<PaymentMethod>(["cash", "transfer", "card_posnet", "mercadopago"]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

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
      const awaitingTransfer = data.status === "pending_payment" && data.awaitingTransfer === true;
      // Una seña por transferencia se confirma por su propio camino
      // (confirmTransferDeposit): registra el monto exacto de la seña y
      // recién ahí arma la ficha de la clienta.
      if (awaitingTransfer && status === "confirmed") throw new Error("Esta seña es por transferencia: confirmala con \"Confirmar seña\" cuando veas el comprobante.");
      const update: Record<string, unknown> = { status, cancelReason: String(formData.get("reason") || "") || null, updatedAt: FieldValue.serverTimestamp() };
      if (status === "cancelled") {
        update.cancelSource = "owner";
        update.cancelledAt = FieldValue.serverTimestamp();
      }
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
      }
      if (status === "cancelled" && data.awaitingTransfer === true) update.awaitingTransfer = false;
      transaction.update(appointmentRef, update);
      // Pendiente de transferencia (y su contador por teléfono) en la MISMA
      // transacción: antes se borraba después del commit y, si eso fallaba,
      // el badge del home seguía contando un turno que ya no esperaba nada.
      if (status === "confirmed" || status === "cancelled") endTransferWait(transaction, tenant.id, appointmentId, data);
      if (data.clientId && status === "no_show") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { noShowCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (data.clientId && status === "completed") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { lastVisitAt: data.startsAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const historyRef = appointmentRef.collection("statusHistory").doc();
      transaction.create(historyRef, { id: historyRef.id, from: data.status, to: status, reason: update.cancelReason, depositDisposition: update.depositDisposition ?? null, changedBy: user.uid, createdAt: FieldValue.serverTimestamp() });
    });
    if (RELEASES_OCCUPANCY.has(status)) await releaseAppointmentOccupancy(tenant.id, appointmentId);
    revalidatePath(`/app/${slug}/agenda`);
    revalidatePath(`/app/${slug}/transferencias`);
    revalidatePath(`/app/${slug}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el turno" };
  }
  redirect(`/app/${slug}/agenda?date=${dateISO}`);
}

export type RefundResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * "Marcar seña devuelta": la dueña ya le devolvió la plata a la clienta de
 * un turno cancelado con la seña marcada "Devolver". En una transacción:
 * - el turno queda `depositRefunded: true` (+ cuándo y quién), así sale de
 *   "A devolver" (isRefundDue en stats-model.ts);
 * - sus pagos aprobados pasan a `refunded` (normalizePayment ya no los
 *   cuenta en Cobrado/Reportes), con `refundedAt`. Son los mismos pagos
 *   que Caja mostraba en "A devolver" (todos los del turno);
 * - se descuenta de totalSpent de la ficha y queda en el historial.
 * Mismo efecto que el reintegro automático de Mercado Pago (checkout.ts).
 * Idempotente: si ya estaba devuelta no hace nada.
 */
export async function markDepositRefunded(slug: string, appointmentId: string): Promise<RefundResult> {
  try {
    const user = await getCurrentFirebaseUser();
    if (!user) return { ok: false, error: "Tu sesión venció. Volvé a iniciar sesión." };
    if (typeof slug !== "string" || typeof appointmentId !== "string" || !ID_PATTERN.test(appointmentId)) return { ok: false, error: "El turno no existe" };
    const { tenant } = await requireTenantAccess(user.uid, slug);
    const db = firebaseAdmin().db;
    const tenantRef = db.collection("tenants").doc(tenant.id);
    const appointmentRef = tenantRef.collection("appointments").doc(appointmentId);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appointmentRef);
      if (!snapshot.exists) throw new Error("El turno no existe");
      const data = snapshot.data()!;
      if (data.depositRefunded === true) return "already" as const;
      if (!isRefundDue(data)) throw new Error("Este turno no tiene una seña pendiente de devolver");
      // Pocos pagos por turno: se leen todos (sin índice) y se filtran acá.
      // Sin `status` = aprobado (pagos viejos, mismo default que normalizePayment).
      const payments = await transaction.get(appointmentRef.collection("payments"));
      const approved = payments.docs.filter((doc) => (doc.data().status ?? "approved") === "approved");
      const refundedApplied = roundMoney(approved.reduce((sum, doc) => sum + Number(doc.data().appliedAmount ?? doc.data().amount ?? 0), 0));

      for (const payment of approved) {
        transaction.update(payment.ref, { status: "refunded", refundedAt: FieldValue.serverTimestamp(), refundedBy: user.uid });
      }
      transaction.update(appointmentRef, {
        depositRefunded: true,
        depositRefundedAt: FieldValue.serverTimestamp(),
        depositRefundedBy: user.uid,
        depositPaid: Math.max(0, roundMoney(Number(data.depositPaid ?? 0) - refundedApplied)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (data.clientId && refundedApplied > 0) {
        transaction.set(tenantRef.collection("clients").doc(String(data.clientId)), {
          totalSpent: FieldValue.increment(-refundedApplied), updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      const historyRef = appointmentRef.collection("statusHistory").doc();
      transaction.create(historyRef, {
        id: historyRef.id, from: data.status, to: data.status, event: "deposit_refunded",
        reason: "Seña devuelta", depositDisposition: "refund_required", amount: refundedApplied,
        changedBy: user.uid, createdAt: FieldValue.serverTimestamp(),
      });
      return "refunded" as const;
    });
    revalidatePath(`/app/${slug}/agenda/${appointmentId}`);
    revalidatePath(`/app/${slug}/caja`);
    revalidatePath(`/app/${slug}/caja/historial`);
    revalidatePath(`/app/${slug}/reportes`);
    revalidatePath(`/app/${slug}`);
    return { ok: true, message: result === "already" ? "Esa seña ya estaba marcada como devuelta" : "Listo: la seña quedó marcada como devuelta" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo marcar la seña como devuelta" };
  }
}
