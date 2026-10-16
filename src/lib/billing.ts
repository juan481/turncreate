// Suscripción del LOCAL a TurnCreate (lo que el local le paga a Just Create).
// Nada que ver con las señas que las clientas le pagan al local.
//
// Lógica pura (sin Firestore ni Next): la usan el panel del local, /platform,
// el turnero público y los gates de las server actions, así las reglas son
// las mismas en todas las puntas. Fechas en milisegundos epoch.
import type { PlanId } from "./plans";

/**
 * - free:      cortesía / todo gratis, sin vencimiento (default de hoy para locales nuevos).
 * - trial:     prueba hasta `trialEndsAt`.
 * - active:    suscripción de Mercado Pago al día, cubre hasta `currentPeriodEnd`.
 * - past_due:  MP avisó un cobro rechazado; corre la gracia desde `currentPeriodEnd`.
 * - unpaid:    interrumpido por falta de pago (forzado desde /platform o por vencimiento).
 * - cancelled: dado de baja.
 */
export type BillingStatus = "free" | "trial" | "active" | "past_due" | "unpaid" | "cancelled";

export const BILLING_STATUSES: BillingStatus[] = ["free", "trial", "active", "past_due", "unpaid", "cancelled"];

export const DEFAULT_GRACE_DAYS = 3;

/** Shape de `tenants/{id}.billing` (las fechas guardadas como Timestamp se pasan acá en ms). */
export type TenantBilling = {
  status: BillingStatus;
  plan: PlanId;
  trialEndsAt?: number | null;
  currentPeriodEnd?: number | null;
  graceDays?: number | null;
  mpPreapprovalId?: string | null;
  mpPreapprovalStatus?: string | null;
  payerEmail?: string | null;
  cancelledAt?: number | null;
};

/**
 * - full:     todo anda.
 * - grace:    todo anda, con aviso amarillo ("tu pago venció, regularizalo antes del X").
 * - readonly: "Por falta de pago tu turnero está interrumpido": turnero público
 *             cerrado y el panel solo deja mirar (ninguna server action que escriba).
 */
export type BillingAccessLevel = "full" | "grace" | "readonly";

export type BillingAccess = {
  level: BillingAccessLevel;
  /** Por qué (para el copy de banners/carteles). */
  reason: "free" | "trial" | "paid" | "trial_ended" | "payment_overdue" | "unpaid" | "cancelled";
  /** En grace: cuándo pasa a readonly. En trial/active: cuándo vence. */
  until: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function afterDeadline(deadline: number | null | undefined, now: number, graceDays: number, okReason: BillingAccess["reason"], lateReason: BillingAccess["reason"]): BillingAccess {
  // Sin fecha no hay nada vencido: se trata como al día.
  if (deadline == null) return { level: "full", reason: okReason, until: null };
  if (now < deadline) return { level: "full", reason: okReason, until: deadline };
  const graceEnd = deadline + graceDays * DAY_MS;
  if (now < graceEnd) return { level: "grace", reason: lateReason, until: graceEnd };
  return { level: "readonly", reason: lateReason, until: null };
}

/**
 * Nivel de acceso de un local según su suscripción. Sin `billing` (locales
 * anteriores a la suscripción) = free: nadie pierde nada por el cambio.
 */
export function billingAccess(billing: TenantBilling | null | undefined, now: number): BillingAccess {
  if (!billing) return { level: "full", reason: "free", until: null };
  const grace = Math.max(0, billing.graceDays ?? DEFAULT_GRACE_DAYS);
  switch (billing.status) {
    case "free":
      return { level: "full", reason: "free", until: null };
    case "trial":
      return afterDeadline(billing.trialEndsAt, now, grace, "trial", "trial_ended");
    case "active":
      return afterDeadline(billing.currentPeriodEnd, now, grace, "paid", "payment_overdue");
    case "past_due":
      // MP ya avisó el rechazo: la gracia corre desde el fin del período pago
      // (o desde ahora si no hay fecha), nunca da acceso pleno.
      {
        const access = afterDeadline(billing.currentPeriodEnd ?? now, now, grace, "payment_overdue", "payment_overdue");
        return access.level === "full" ? { level: "grace", reason: "payment_overdue", until: (billing.currentPeriodEnd ?? now) + grace * DAY_MS } : access;
      }
    case "unpaid":
      return { level: "readonly", reason: "unpaid", until: null };
    case "cancelled":
      return { level: "readonly", reason: "cancelled", until: null };
    default:
      return { level: "full", reason: "free", until: null };
  }
}

/** ¿El turnero público puede tomar reservas según la suscripción? */
export function billingAllowsPublicBooking(billing: TenantBilling | null | undefined, now: number): boolean {
  return billingAccess(billing, now).level !== "readonly";
}

/** ¿El panel puede escribir (crear turnos, cobrar, configurar)? */
export function billingAllowsWrites(billing: TenantBilling | null | undefined, now: number): boolean {
  return billingAccess(billing, now).level !== "readonly";
}

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  free: "Cortesía",
  trial: "En prueba",
  active: "Al día",
  past_due: "Pago vencido",
  unpaid: "Interrumpido por falta de pago",
  cancelled: "Dado de baja",
};
