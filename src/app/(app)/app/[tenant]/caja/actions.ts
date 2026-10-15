"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { paymentDocument, type PaymentMethod } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";

export type CajaActionState = { error: string | null };
export type ChargeActionState = { error: string | null };
const METHODS = new Set<PaymentMethod>(["cash", "transfer", "card_posnet", "mercadopago"]);

async function access(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return requireTenantAccess(user.uid, slug);
}

export async function openCash(tenantSlug: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  try {
    const { tenant } = await access(tenantSlug);
    const db = firebaseAdmin().db;
    const open = await db.collection("tenants").doc(tenant.id).collection("cashSessions").where("closedAt", "==", null).limit(1).get();
    if (!open.empty) return { error: "Ya hay una caja abierta" };
    const ref = db.collection("tenants").doc(tenant.id).collection("cashSessions").doc();
    await ref.create({ id: ref.id, openingAmount: Number(formData.get("openingAmount") ?? 0), openedAt: FieldValue.serverTimestamp(), closedAt: null, expectedAmount: 0, createdAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/caja`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo abrir la caja" }; }
}

export async function closeCash(tenantSlug: string, sessionId: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  try {
    const { tenant } = await access(tenantSlug);
    const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId);
    const [movements, sessionSnapshot] = await Promise.all([ref.collection("movements").get(), ref.get()]);
    const session = sessionSnapshot.data();
    if (!session || session.closedAt) return { error: "La caja no está abierta" };
    const expected = Number(session.openingAmount ?? 0) + movements.docs.reduce((sum, movement) => { const data = movement.data(); return sum + (data.type === "in" ? Number(data.amount) : -Number(data.amount)); }, 0);
    const counted = Number(formData.get("countedAmount") ?? 0);
    await ref.update({ closedAt: FieldValue.serverTimestamp(), expectedAmount: expected, countedAmount: counted, difference: counted - expected, differenceReason: String(formData.get("differenceReason") || "") || null });
    revalidatePath(`/app/${tenantSlug}/caja`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo cerrar la caja" }; }
}

export async function addCashMovement(tenantSlug: string, sessionId: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  const type = formData.get("type");
  const amount = Number(formData.get("amount") ?? 0);
  if ((type !== "in" && type !== "out") || amount <= 0) return { error: "Ingresá un movimiento válido" };
  try {
    const { tenant } = await access(tenantSlug);
    const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId).collection("movements").doc();
    await ref.create({ id: ref.id, type, amount, method: "cash", reason: String(formData.get("reason") || ""), createdAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/caja`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo registrar el movimiento" }; }
}

export async function chargeAppointment(tenantSlug: string, _prev: ChargeActionState, formData: FormData): Promise<ChargeActionState> {
  const appointmentId = formData.get("appointmentId");
  const sessionId = formData.get("sessionId");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  if (typeof appointmentId !== "string" || !METHODS.has(method) || amount <= 0) return { error: "Faltan datos para cobrar" };
  try {
    const { tenant } = await access(tenantSlug);
    const db = firebaseAdmin().db;
    const appointmentRef = db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId);
    await db.runTransaction(async (transaction) => {
      const appointment = await transaction.get(appointmentRef);
      if (!appointment.exists) throw new Error("El turno no existe");
      const data = appointment.data()!;
      if (["cancelled", "no_show", "expired"].includes(String(data.status))) throw new Error("Este turno está cancelado o ausente, no se puede cobrar");
      const currentBalance = Number(data.balance ?? data.total ?? 0);
      if (amount > currentBalance + 0.01) throw new Error("El monto supera el saldo pendiente");
      const balance = Math.max(0, currentBalance - amount);
      const paymentRef = appointmentRef.collection("payments").doc();
      transaction.create(paymentRef, paymentDocument({ id: paymentRef.id, kind: Number(data.depositPaid ?? 0) > 0 ? "balance" : "deposit", method, status: "approved", grossAmount: amount, appliedAmount: amount, feeAmount: 0, surchargeAmount: 0, netAmount: amount, paidAt: new Date(), source: "cash_register", tenantId: tenant.id, appointmentId }));
      transaction.update(appointmentRef, { balance, status: balance === 0 ? "completed" : data.status, updatedAt: FieldValue.serverTimestamp() });
      if (data.clientId) transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (method === "cash" && typeof sessionId === "string" && sessionId) {
        const movementRef = db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId).collection("movements").doc();
        transaction.create(movementRef, { id: movementRef.id, type: "in", amount, method, reason: `Cobro turno · ${String(data.clientName ?? "")}`.trim(), appointmentId, createdAt: FieldValue.serverTimestamp() });
      }
    });
    revalidatePath(`/app/${tenantSlug}/caja`);
    revalidatePath(`/app/${tenantSlug}/agenda`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo cobrar el turno" }; }
}
