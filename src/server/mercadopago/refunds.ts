import "server-only";

import { MercadoPagoConfig, PaymentRefund } from "mercadopago";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { roundMoney } from "@/domain/money/payment";
import { sellerAccessToken } from "./connections";

export type AutomaticRefundResult = "refunded" | "processing" | "manual_required" | "not_needed";

/**
 * Devuelve automáticamente las señas cobradas por Mercado Pago. Los cobros
 * por transferencia u otros medios quedan en la cola manual "A devolver".
 * La clave de idempotencia es estable por turno y pago, para que un reintento
 * nunca genere dos devoluciones.
 */
export async function refundAppointmentMercadoPagoDeposit(tenantId: string, appointmentId: string): Promise<AutomaticRefundResult> {
  const db = firebaseAdmin().db;
  const appointmentRef = db.collection("tenants").doc(tenantId).collection("appointments").doc(appointmentId);
  const payments = await appointmentRef.collection("payments").get();
  // La política cubre únicamente la seña. Un turno puede tener otros cobros
  // registrados, que nunca deben devolverse por este flujo automático.
  const approvedDeposits = payments.docs.filter((doc) => {
    const data = doc.data();
    return (data.status ?? "approved") === "approved" && (data.kind === "deposit" || data.source === "public_checkout");
  });
  if (approvedDeposits.length === 0) return "not_needed";
  const mercadoPagoPayments = approvedDeposits.filter((doc) => doc.data().method === "mercadopago" && doc.data().externalPaymentId);
  if (mercadoPagoPayments.length === 0) return "manual_required";

  const accessToken = await sellerAccessToken(tenantId);
  const client = new PaymentRefund(new MercadoPagoConfig({ accessToken }));
  const approvedRefundIds: string[] = [];
  let processing = false;

  for (const payment of mercadoPagoPayments) {
    const externalPaymentId = String(payment.data().externalPaymentId);
    const response = await client.total({
      payment_id: externalPaymentId,
      requestOptions: { idempotencyKey: `tc-cancel-${appointmentId}-${payment.id}`, timeout: 15_000 },
    });
    if (response.status === "approved") approvedRefundIds.push(payment.id);
    else processing = true;
    await payment.ref.set({
      refundRequestId: response.id ? String(response.id) : null,
      refundStatus: response.status ?? "in_process",
      refundRequestedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  if (approvedRefundIds.length > 0) {
    const refs = approvedRefundIds.map((id) => appointmentRef.collection("payments").doc(id));
    await db.runTransaction(async (transaction) => {
      const [appointment, paymentDocs] = await Promise.all([transaction.get(appointmentRef), transaction.getAll(...refs)]);
      if (!appointment.exists) return;
      const data = appointment.data()!;
      const refundable = paymentDocs.filter((doc) => doc.exists && (doc.data()?.status ?? "approved") === "approved");
      const applied = roundMoney(refundable.reduce((sum, doc) => sum + Number(doc.data()?.appliedAmount ?? doc.data()?.amount ?? 0), 0));
      for (const payment of refundable) transaction.update(payment.ref, { status: "refunded", refundedAt: FieldValue.serverTimestamp(), refundedBy: "mercadopago_api", refundStatus: "approved" });
      const fullyAutomatic = approvedDeposits.every((payment) => approvedRefundIds.includes(payment.id));
      transaction.update(appointmentRef, {
        depositPaid: Math.max(0, roundMoney(Number(data.depositPaid ?? 0) - applied)),
        depositRefunded: fullyAutomatic,
        depositRefundedAt: fullyAutomatic ? FieldValue.serverTimestamp() : null,
        depositRefundedBy: fullyAutomatic ? "mercadopago_api" : null,
        automaticRefundStatus: fullyAutomatic ? "refunded" : "partial",
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (data.clientId && applied > 0) transaction.set(appointmentRef.parent.parent!.collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(-applied), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const historyRef = appointmentRef.collection("statusHistory").doc();
      transaction.create(historyRef, { id: historyRef.id, from: data.status, to: data.status, event: "deposit_refunded", reason: "Seña devuelta automáticamente por Mercado Pago", depositDisposition: "refund_required", amount: applied, changedBy: "mercadopago_api", createdAt: FieldValue.serverTimestamp() });
    });
  }

  if (processing) return "processing";
  return approvedDeposits.every((payment) => approvedRefundIds.includes(payment.id)) ? "refunded" : "manual_required";
}
