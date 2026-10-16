import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { billingAccess, billingAllowsPublicBooking, type BillingAccess, type TenantBilling } from "@/lib/billing";
import type { PlanId } from "@/lib/plans";
import { firebaseAdmin } from "@/server/firebase/admin";
import type { BillingConfig } from "./config";
import { initialBilling, readTenantBilling as readTenantBillingModel, type BillingPatch } from "./model";

/**
 * `tenants/{id}` (los datos del doc) → TenantBilling con fechas en ms.
 * Acepta Timestamp de Firestore, número o ISO; valida status y plan.
 * null = sin suscripción registrada (locales viejos) → free para billingAccess.
 */
export function readTenantBilling(tenantData: unknown): TenantBilling | null {
  return readTenantBillingModel(tenantData);
}

/**
 * ¿El turnero público del local toma reservas según su suscripción?
 * false = "Por falta de pago tu turnero está interrumpido" (solo lectura).
 */
export function tenantBillingAllowsPublicBooking(tenantData: unknown, now: number = Date.now()): boolean {
  return billingAllowsPublicBooking(readTenantBilling(tenantData), now);
}

/** Nivel de acceso (full | grace | readonly) de un local a partir de su doc. */
export function tenantBillingAccess(tenantData: unknown, now: number = Date.now()): BillingAccess {
  return billingAccess(readTenantBilling(tenantData), now);
}

const DATE_FIELDS = new Set<keyof TenantBilling>(["trialEndsAt", "currentPeriodEnd", "cancelledAt"]);

function firestoreValue(key: keyof TenantBilling, value: unknown) {
  if (value == null) return null;
  return DATE_FIELDS.has(key) && typeof value === "number" ? Timestamp.fromMillis(value) : value;
}

/** TenantBilling (ms) → mapa listo para Firestore (fechas como Timestamp). */
export function billingToFirestore(billing: TenantBilling): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(billing)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, firestoreValue(key as keyof TenantBilling, value)]),
  );
}

/**
 * Patch (ms) → campos para `update()` con field paths `billing.x`, así nunca
 * pisa otros campos del mapa (notas de /platform, etc.). Si el patch cambia
 * el plan, también se copia al `plan` del local (el que lee planFeatures).
 */
export function billingPatchToUpdate(patch: BillingPatch): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    update[`billing.${key}`] = firestoreValue(key as keyof TenantBilling, value);
  }
  if (patch.plan) update.plan = patch.plan;
  return update;
}

/**
 * El mapa `billing` para un local nuevo según la config: cortesía (free) o
 * prueba con `trialEndsAt` = ahora + trialDays. Fechas como Timestamp.
 */
export function initialBillingFor(config: BillingConfig, plan: PlanId, now: number): Record<string, unknown> {
  return billingToFirestore(initialBilling(config, plan, now));
}

/** Billing de un local por id (null si no existe el local o no tiene billing). */
export async function getTenantBilling(tenantId: string): Promise<TenantBilling | null> {
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  return snapshot.exists ? readTenantBilling(snapshot.data()) : null;
}

export type BillingPaymentRow = {
  id: string;
  tenantId: string;
  amount: number;
  currency: string;
  status: "approved" | "rejected";
  plan: PlanId | null;
  mpId: string;
  paidAt: number | null;
};

/**
 * Últimos cobros de la suscripción de un local (billingPayments), más nuevo
 * primero. Usa el índice compuesto billingPayments(tenantId ASC, paidAt DESC).
 */
export async function listBillingPayments(tenantId: string, limit = 24): Promise<BillingPaymentRow[]> {
  const snapshot = await firebaseAdmin().db.collection("billingPayments")
    .where("tenantId", "==", tenantId)
    .orderBy("paidAt", "desc")
    .limit(Math.max(1, Math.min(100, limit)))
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      tenantId: String(data.tenantId),
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? "ARS"),
      status: data.status === "approved" ? "approved" : "rejected",
      plan: data.plan === "solo" || data.plan === "equipo" || data.plan === "pro" ? data.plan : null,
      mpId: String(data.mpId ?? doc.id),
      paidAt: data.paidAt?.toMillis?.() ?? null,
    };
  });
}
