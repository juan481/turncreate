"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { paymentDocument, type PaymentMethod } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";

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
    const appointmentRef = db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(appointmentRef);
      if (!snapshot.exists) throw new Error("El turno no existe");
      const data = snapshot.data()!;
      if (!(ALLOWED[String(data.status)] ?? []).includes(status)) throw new Error("Ese cambio de estado no estÃ¡ permitido");
      const update: Record<string, unknown> = { status, cancelReason: String(formData.get("reason") || "") || null, updatedAt: FieldValue.serverTimestamp() };
      if (status === "cancelled" && Number(data.depositPaid ?? 0) > 0) {
        const disposition = String(formData.get("depositDisposition") ?? "");
        if (!new Set(["retained", "refund_required", "credit"]).has(disposition)) throw new Error("ElegÃ­ quÃ© hacer con la seÃ±a");
        update.depositDisposition = disposition;
      }
      if (data.status === "pending_payment" && status === "confirmed") {
        const amount = Number(formData.get("amount") ?? 0);
        const method = String(formData.get("method") ?? "") as PaymentMethod;
        if (amount <= 0 || !METHODS.has(method)) throw new Error("IngresÃ¡ monto y medio de pago");
        const applied = Math.min(amount, Number(data.balance ?? data.total ?? amount));
        const paymentRef = appointmentRef.collection("payments").doc();
        transaction.create(paymentRef, paymentDocument({ id: paymentRef.id, kind: Number(data.depositPaid ?? 0) > 0 ? "balance" : "deposit", method, status: "approved", grossAmount: amount, appliedAmount: applied, feeAmount: 0, surchargeAmount: 0, netAmount: amount, paidAt: new Date(), source: "admin", tenantId: tenant.id, appointmentId }));
        if (data.clientId) transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(applied), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        update.balance = Math.max(0, Number(data.balance ?? data.total ?? 0) - applied);
        if (Number(data.depositPaid ?? 0) === 0) update.depositPaid = applied;
      }
      transaction.update(appointmentRef, update);
      if (data.clientId && status === "no_show") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { noShowCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (data.clientId && status === "completed") transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { lastVisitAt: data.startsAt, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const historyRef = appointmentRef.collection("statusHistory").doc();
      transaction.create(historyRef, { id: historyRef.id, from: data.status, to: status, reason: update.cancelReason, depositDisposition: update.depositDisposition ?? null, changedBy: user.uid, createdAt: FieldValue.serverTimestamp() });
    });
    if (RELEASES_OCCUPANCY.has(status)) await releaseAppointmentOccupancy(tenant.id, appointmentId);
    revalidatePath(`/app/${slug}/agenda`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el turno" };
  }
  redirect(`/app/${slug}/agenda?date=${dateISO}`);
}
