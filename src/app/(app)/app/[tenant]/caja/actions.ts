"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { paymentDocument, type PaymentMethod } from "@/domain/money/payment";
import { chargeKind, splitCharge } from "@/domain/money/split-payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { planFeatures } from "@/lib/plans";

export type CajaActionState = { error: string | null };
export type ChargeActionState = { error: string | null };
const METHODS = new Set<PaymentMethod>(["cash", "transfer", "card_posnet", "mercadopago"]);

async function access(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return { user, ...(await requireTenantAccess(user.uid, slug)) };
}

/** Todo lo que muestra plata del día: Caja (Hoy + Historial), Reportes y la home. */
function revalidateMoney(slug: string) {
  revalidatePath(`/app/${slug}/caja`);
  revalidatePath(`/app/${slug}/caja/historial`);
  revalidatePath(`/app/${slug}/reportes`);
  revalidatePath(`/app/${slug}`);
}

export async function openCash(tenantSlug: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  try {
    const { tenant } = await access(tenantSlug);
    if (!planFeatures(tenant).cashSessions) return { error: "Tu plan registra cobros sin apertura de caja" };
    const openingAmount = Number(formData.get("openingAmount") ?? 0);
    if (!Number.isFinite(openingAmount) || openingAmount < 0) return { error: "Ingresá un monto inicial válido" };
    const db = firebaseAdmin().db;
    const open = await db.collection("tenants").doc(tenant.id).collection("cashSessions").where("closedAt", "==", null).limit(1).get();
    if (!open.empty) return { error: "Ya hay una caja abierta" };
    const ref = db.collection("tenants").doc(tenant.id).collection("cashSessions").doc();
    await ref.create({ id: ref.id, openingAmount, openedAt: FieldValue.serverTimestamp(), closedAt: null, expectedAmount: 0, createdAt: FieldValue.serverTimestamp() });
    revalidateMoney(tenantSlug);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo abrir la caja" }; }
}

export async function closeCash(tenantSlug: string, sessionId: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  try {
    const { tenant } = await access(tenantSlug);
    if (!planFeatures(tenant).cashSessions) return { error: "Tu plan no usa arqueo de caja" };
    const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId);
    const [movements, sessionSnapshot] = await Promise.all([ref.collection("movements").get(), ref.get()]);
    const session = sessionSnapshot.data();
    if (!session || session.closedAt) return { error: "La caja no está abierta" };
    const expected = Number(session.openingAmount ?? 0) + movements.docs.reduce((sum, movement) => { const data = movement.data(); return sum + (data.type === "in" ? Number(data.amount) : -Number(data.amount)); }, 0);
    const counted = Number(formData.get("countedAmount") ?? 0);
    if (!Number.isFinite(counted) || counted < 0) return { error: "Ingresá un efectivo contado válido" };
    await ref.update({ closedAt: FieldValue.serverTimestamp(), expectedAmount: expected, countedAmount: counted, difference: counted - expected, differenceReason: String(formData.get("differenceReason") || "") || null });
    revalidateMoney(tenantSlug);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo cerrar la caja" }; }
}

export async function addCashMovement(tenantSlug: string, sessionId: string, _prev: CajaActionState, formData: FormData): Promise<CajaActionState> {
  const category = String(formData.get("category") ?? "");
  const categoryTypes = { withdrawal: "out", expense: "out", income: "in" } as const;
  const type = categoryTypes[category as keyof typeof categoryTypes];
  const amount = Number(formData.get("amount") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!type || !Number.isFinite(amount) || amount <= 0 || reason.length < 2) return { error: "Completá el tipo, el monto y el motivo" };
  try {
    const { tenant } = await access(tenantSlug);
    if (!planFeatures(tenant).cashSessions) return { error: "Tu plan no usa movimientos de caja" };
    const sessionRef = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId);
    await firebaseAdmin().db.runTransaction(async (transaction) => {
      const session = await transaction.get(sessionRef);
      if (!session.exists || session.data()?.closedAt) throw new Error("La caja ya no está abierta");
      const ref = sessionRef.collection("movements").doc();
      transaction.create(ref, { id: ref.id, type, category, amount, method: "cash", reason, createdAt: FieldValue.serverTimestamp() });
    });
    revalidateMoney(tenantSlug);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo registrar el movimiento" }; }
}

export async function chargeAppointment(tenantSlug: string, _prev: ChargeActionState, formData: FormData): Promise<ChargeActionState> {
  const appointmentId = formData.get("appointmentId");
  const sessionId = formData.get("sessionId");
  const amount = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "") as PaymentMethod;
  const secondaryMethodRaw = String(formData.get("secondaryMethod") ?? "");
  const secondaryMethod = secondaryMethodRaw ? secondaryMethodRaw as PaymentMethod : null;
  const secondaryAmount = Number(formData.get("secondaryAmount") ?? 0);
  const productId = typeof formData.get("productId") === "string" ? String(formData.get("productId")) : "";
  if (typeof appointmentId !== "string" || !METHODS.has(method) || (secondaryMethod !== null && !METHODS.has(secondaryMethod)) || !Number.isFinite(amount) || amount <= 0) return { error: "Faltan datos para cobrar" };
  try {
    const { user, tenant } = await access(tenantSlug);
    const db = firebaseAdmin().db;
    const appointmentRef = db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId);
    await db.runTransaction(async (transaction) => {
      const appointment = await transaction.get(appointmentRef);
      if (!appointment.exists) throw new Error("El turno no existe");
      const data = appointment.data()!;
      if (["cancelled", "no_show", "expired"].includes(String(data.status))) throw new Error("Este turno está cancelado o ausente, no se puede cobrar");
      // Una seña por transferencia se confirma solo por confirmTransferDeposit
      // (monto exacto de la seña, ficha de la clienta, contadores, fin del
      // pendiente). Cobrarla acá como "saldo" la salteaba.
      if (data.status === "pending_payment" && data.awaitingTransfer === true) {
        throw new Error("Confirmá primero la transferencia en Transferencias");
      }
      const currentBalance = Number(data.balance ?? data.total ?? 0);
      if (amount > currentBalance + 0.01) throw new Error("El monto supera el saldo pendiente");
      const productSnapshot = productId
        ? await transaction.get(db.collection("tenants").doc(tenant.id).collection("products").doc(productId))
        : null;
      if (productSnapshot && (!productSnapshot.exists || productSnapshot.data()?.active === false)) throw new Error("El producto ya no está disponible");
      const productAmount = productSnapshot ? Number(productSnapshot.data()?.price ?? 0) : 0;
      if (!Number.isFinite(productAmount) || productAmount < 0) throw new Error("El precio del producto no es válido");
      if (data.status === "pending_payment" && Number(data.depositDue ?? 0) > 0 && amount + 0.01 < Number(data.depositDue)) {
        throw new Error("Para confirmar el turno tenés que cobrar al menos la seña pendiente");
      }
      const splits = splitCharge({ serviceAmount: amount, productAmount, primaryMethod: method, secondaryMethod, secondaryAmount });
      const cashAmount = splits.filter((split) => split.method === "cash").reduce((sum, split) => sum + split.grossAmount, 0);
      const cashSessionRef = cashAmount > 0 && typeof sessionId === "string" && sessionId
        ? db.collection("tenants").doc(tenant.id).collection("cashSessions").doc(sessionId)
        : null;
      const cashSession = cashSessionRef ? await transaction.get(cashSessionRef) : null;
      if (cashSession && (!cashSession.exists || cashSession.data()?.closedAt)) throw new Error("La caja ya no está abierta");
      const grossAmount = splits.reduce((sum, split) => sum + split.grossAmount, 0);
      const balance = Math.max(0, currentBalance - amount);
      const kind = chargeKind({ total: Number(data.total ?? currentBalance), currentBalance, appliedAmount: amount });
      const paymentGroupId = appointmentRef.collection("payments").doc().id;
      for (const split of splits) {
        const portions = [
          ...(split.appliedAmount > 0 ? [{ kind, gross: split.appliedAmount, applied: split.appliedAmount, product: false }] : []),
          ...(split.productAmount > 0 ? [{ kind: "adjustment" as const, gross: split.productAmount, applied: 0, product: true }] : []),
        ];
        for (const portion of portions) {
          const paymentRef = appointmentRef.collection("payments").doc();
          transaction.create(paymentRef, {
            ...paymentDocument({ id: paymentRef.id, kind: portion.kind, method: split.method, status: "approved", grossAmount: portion.gross, appliedAmount: portion.applied, feeAmount: 0, surchargeAmount: 0, netAmount: portion.gross, paidAt: new Date(), source: "cash_register", tenantId: tenant.id, appointmentId }),
            paymentGroupId,
            mixedPayment: splits.length > 1,
            ...(split.method === "mercadopago" ? { feeUnknown: true } : {}),
            ...(portion.product && productSnapshot ? { productId, productName: String(productSnapshot.data()?.name ?? "Producto"), productAmount: portion.gross } : {}),
          });
        }
      }
      // Pagar y prestar el servicio son hechos distintos: saldo cero no
      // significa que el turno ya se realizó. Solo sale de pending_payment.
      const confirming = data.status === "pending_payment";
      const update: Record<string, unknown> = { balance, status: confirming ? "confirmed" : data.status, updatedAt: FieldValue.serverTimestamp() };
      if (confirming) {
        // Mismo criterio que "Registrar pago" en el detalle del turno: lo
        // que entra con el turno pendiente es la seña (así, si después se
        // cancela, se pregunta qué hacer con ella).
        if (Number(data.depositPaid ?? 0) === 0) update.depositPaid = Math.min(amount, Number(data.depositDue ?? amount));
        const historyRef = appointmentRef.collection("statusHistory").doc();
        transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "confirmed", reason: "Cobrado en caja", depositDisposition: null, changedBy: user.uid, createdAt: FieldValue.serverTimestamp() });
      }
      if (!confirming && kind === "deposit" && Number(data.depositPaid ?? 0) === 0) update.depositPaid = amount;
      transaction.update(appointmentRef, update);
      if (data.clientId) transaction.set(db.collection("tenants").doc(tenant.id).collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(grossAmount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      if (productSnapshot) {
        const saleRef = db.collection("tenants").doc(tenant.id).collection("productSales").doc();
        transaction.create(saleRef, { id: saleRef.id, productId, productName: String(productSnapshot.data()?.name ?? "Producto"), quantity: 1, unitPrice: productAmount, total: productAmount, method: splits.length > 1 ? "mixed" : method, paymentMethods: splits.map((split) => split.method), appointmentId, clientId: data.clientId ?? null, soldAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() });
      }
      if (cashSessionRef) {
        const movementRef = cashSessionRef.collection("movements").doc();
        transaction.create(movementRef, { id: movementRef.id, type: "in", category: "appointment", amount: cashAmount, method: "cash", reason: `${splits.length > 1 ? "Cobro mixto" : "Cobro turno"} · ${String(data.clientName ?? "")}`.trim(), appointmentId, paymentGroupId, createdAt: FieldValue.serverTimestamp() });
      }
    });
    revalidateMoney(tenantSlug);
    revalidatePath(`/app/${tenantSlug}/agenda`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo cobrar el turno" }; }
}
