import { BILLING_STATUS_LABEL, billingAccess, type BillingAccess, type BillingStatus, type TenantBilling } from "@/lib/billing";
import { PLANS, isPlanId, type PlanId } from "@/lib/plans";
import { addDaysISO, startOfDayInTz, toDateISOInTz, todayISO } from "@/lib/dates";
import { PLATFORM_TZ, formatMoney, platformDateLabel, type Check, type PlatformTone } from "./model";

/**
 * Lógica pura de la suscripción de un local vista desde /platform (lo que
 * el local le paga a Just Create): qué cambio pidió el admin, si se puede
 * hacer desde el estado LEÍDO EN EL SERVIDOR, qué campos de `billing.*`
 * escribir y qué queda en la auditoría. Sin Firestore: la Server Action
 * convierte las fechas (ms) a Timestamp y escribe con field paths.
 */

/* ------------------------------------------------------------------ */
/* Estado efectivo (pill + filtro del listado)                          */
/* ------------------------------------------------------------------ */

/** Filtro del listado: "overdue" junta pago vencido + prueba/período que ya pasaron. */
export type BillingFilterKey = "free" | "trial" | "active" | "overdue" | "unpaid" | "cancelled";
export type BillingFilter = "all" | BillingFilterKey;
export const BILLING_FILTERS: readonly BillingFilter[] = ["all", "free", "trial", "active", "overdue", "unpaid", "cancelled"];

export const BILLING_FILTER_LABEL: Record<BillingFilter, string> = {
  all: "Todas",
  free: "Cortesía",
  trial: "Prueba",
  active: "Al día",
  overdue: "Vencido",
  unpaid: "Interrumpido",
  cancelled: "Baja",
};

export function billingFilterOf(status: BillingStatus, access: BillingAccess): BillingFilterKey {
  switch (status) {
    case "trial":
      return access.level === "full" ? "trial" : "overdue";
    case "active":
      return access.level === "full" ? "active" : "overdue";
    case "past_due":
      return "overdue";
    case "unpaid":
    case "cancelled":
    case "free":
      return status;
    default:
      return "free";
  }
}

export type BillingBadge = { label: string; tone: PlatformTone; filter: BillingFilterKey };

/** Pill/dot de la suscripción. Sin `billing` = Cortesía (locales anteriores a las suscripciones). */
export function billingBadge(billing: TenantBilling | null, access: BillingAccess): BillingBadge {
  const status: BillingStatus = billing?.status ?? "free";
  const filter = billingFilterOf(status, access);
  if (status === "trial" && filter === "overdue") return { label: "Prueba vencida", tone: "draft", filter };
  if (status === "active" && filter === "overdue") return { label: "Pago vencido", tone: "draft", filter };
  const tone: PlatformTone = status === "trial" ? "pending"
    : status === "past_due" ? "draft"
      : status === "unpaid" || status === "cancelled" ? "alert"
        : "confirmed";
  const label = status === "unpaid" ? "Interrumpido" : BILLING_STATUS_LABEL[status] ?? "Cortesía";
  return { label, tone, filter };
}

/** Plan de la suscripción: billing.plan, si no el plan del local, si no Equipo (lib/plans.ts). */
export function billingPlanOf(billing: TenantBilling | null, tenantPlan: unknown): PlanId {
  if (billing && isPlanId(billing.plan)) return billing.plan;
  return isPlanId(tenantPlan) ? tenantPlan : "equipo";
}

/** "Hasta el 31/10/2026": las fechas de fin se guardan a las 00:00 del día SIGUIENTE al último incluido. */
export function inclusiveEndLabel(endMs: number | null | undefined): string {
  if (endMs == null || !Number.isFinite(endMs)) return "—";
  return platformDateLabel(new Date(endMs - 1));
}

/** Texto de una línea para el detalle: qué tan cerca está de cortarse. */
export function billingAccessSummary(access: BillingAccess): string {
  switch (access.reason) {
    case "free":
      return "Cortesía: usa todo sin pagar y sin vencimiento.";
    case "trial":
      return access.until ? `Prueba hasta el ${inclusiveEndLabel(access.until)}.` : "Prueba sin fecha de fin.";
    case "paid":
      return access.until ? `Pago al día hasta el ${inclusiveEndLabel(access.until)}.` : "Pago al día.";
    case "trial_ended":
      return access.level === "grace" && access.until
        ? `Se terminó la prueba. Sigue andando por la gracia hasta el ${inclusiveEndLabel(access.until)}; después queda en solo lectura.`
        : "Se terminó la prueba y la gracia: el turnero está cerrado y el panel en solo lectura.";
    case "payment_overdue":
      return access.level === "grace" && access.until
        ? `Pago vencido. Sigue andando por la gracia hasta el ${inclusiveEndLabel(access.until)}; después queda en solo lectura.`
        : "Pago vencido y sin gracia: el turnero está cerrado y el panel en solo lectura.";
    case "unpaid":
      return "Interrumpido por falta de pago: turnero cerrado y panel en solo lectura.";
    case "cancelled":
      return "Dado de baja: turnero cerrado y panel en solo lectura.";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/* Cambios pedidos desde /platform                                      */
/* ------------------------------------------------------------------ */

export const BILLING_DAYS_MIN = 1;
export const BILLING_DAYS_MAX = 365;
/** Días por defecto al reactivar como "Al día" a mano (pagó por fuera de Mercado Pago). */
export const DEFAULT_PAID_DAYS = 30;

export type ReactivateTarget = "active" | "free" | "trial";

export type BillingRequest =
  | { kind: "free" }
  | { kind: "trial"; days: number }
  | { kind: "extend"; days: number }
  | { kind: "plan"; plan: PlanId }
  | { kind: "unpaid" }
  | { kind: "reactivate"; to: ReactivateTarget; days?: number }
  | { kind: "cancel" };

export type BillingRequestKind = BillingRequest["kind"];

export type BillingAuditAction =
  | "billing.free"
  | "billing.trial"
  | "billing.extend"
  | "billing.plan"
  | "billing.unpaid"
  | "billing.reactivate"
  | "billing.cancel";

/** Los "negativos" (cortan el servicio) exigen motivo. */
export function billingReasonRequired(kind: BillingRequestKind): boolean {
  return kind === "unpaid" || kind === "cancel";
}

/** Campos de `billing.*` a escribir. null = borrar el campo (fecha que ya no aplica). */
export type BillingPatch = {
  status?: BillingStatus;
  plan?: PlanId;
  trialEndsAt?: number | null;
  currentPeriodEnd?: number | null;
  cancelledAt?: number | null;
};

export type BillingChange = {
  patch: BillingPatch;
  action: BillingAuditAction;
  from: string;
  to: string;
  detail: string | null;
};

function validDays(raw: unknown): Check<number> {
  const days = typeof raw === "number" ? raw : Number.NaN;
  if (!Number.isInteger(days) || days < BILLING_DAYS_MIN || days > BILLING_DAYS_MAX) {
    return { ok: false, error: `Los días tienen que ser un número entero entre ${BILLING_DAYS_MIN} y ${BILLING_DAYS_MAX}` };
  }
  return { ok: true, value: days };
}

/**
 * Fin de un período de `days` días, a las 00:00 (hora argentina) del día
 * siguiente al último incluido. Si `baseMs` es futuro (extender una prueba
 * vigente) se suma desde ahí; si no, desde mañana: hoy no cuenta como día
 * de prueba, así "15 días" el 16/10 = hasta el 31/10 inclusive.
 */
export function periodEndFrom(baseMs: number | null | undefined, days: number, now: Date): number {
  const nowMs = now.getTime();
  const startISO = baseMs != null && Number.isFinite(baseMs) && baseMs > nowMs
    ? toDateISOInTz(new Date(baseMs), PLATFORM_TZ)
    : addDaysISO(todayISO(PLATFORM_TZ, now), 1);
  return startOfDayInTz(addDaysISO(startISO, days), PLATFORM_TZ).getTime();
}

function plural(days: number) {
  return `${days} día${days === 1 ? "" : "s"}`;
}

/** Valida el pedido que llega de la pantalla (una Server Action recibe cualquier cosa). */
export function parseBillingRequest(raw: unknown): Check<BillingRequest> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Pedido inválido" };
  const input = raw as Record<string, unknown>;
  switch (input.kind) {
    case "free":
    case "unpaid":
    case "cancel":
      return { ok: true, value: { kind: input.kind } };
    case "trial":
    case "extend": {
      const days = validDays(input.days);
      return days.ok ? { ok: true, value: { kind: input.kind, days: days.value } } : days;
    }
    case "plan":
      return isPlanId(input.plan) ? { ok: true, value: { kind: "plan", plan: input.plan } } : { ok: false, error: "Plan inválido" };
    case "reactivate": {
      if (input.to !== "active" && input.to !== "free" && input.to !== "trial") return { ok: false, error: "Elegí cómo reactivarlo" };
      if (input.to === "free") return { ok: true, value: { kind: "reactivate", to: "free" } };
      const days = validDays(input.days);
      return days.ok ? { ok: true, value: { kind: "reactivate", to: input.to, days: days.value } } : days;
    }
    default:
      return { ok: false, error: "Acción inválida" };
  }
}

/**
 * Qué escribir para `request` partiendo de `current` (SIEMPRE la lectura
 * del servidor dentro de la transacción). Sin `billing` = cortesía.
 */
export function planBillingChange(
  current: TenantBilling | null,
  tenantPlan: unknown,
  request: BillingRequest,
  now: Date,
): Check<BillingChange> {
  const status: BillingStatus = current?.status ?? "free";
  const plan = billingPlanOf(current, tenantPlan);
  const label = (value: BillingStatus) => BILLING_STATUS_LABEL[value];

  switch (request.kind) {
    case "free":
      if (status === "free") return { ok: false, error: "Ya estaba como cortesía" };
      return {
        ok: true,
        value: {
          patch: { status: "free", plan, trialEndsAt: null, cancelledAt: null },
          action: "billing.free",
          from: status,
          to: "free",
          detail: null,
        },
      };

    case "trial": {
      const access = billingAccess(current, now.getTime());
      if (status === "trial" && access.level === "full") return { ok: false, error: "Ya está en prueba: usá Extender prueba" };
      const end = periodEndFrom(null, request.days, now);
      return {
        ok: true,
        value: {
          patch: { status: "trial", plan, trialEndsAt: end, cancelledAt: null },
          action: "billing.trial",
          from: status,
          to: "trial",
          detail: `Prueba de ${plural(request.days)}, hasta el ${inclusiveEndLabel(end)}`,
        },
      };
    }

    case "extend": {
      if (status !== "trial") return { ok: false, error: `Solo se puede extender una prueba (hoy está ${label(status).toLowerCase()})` };
      const end = periodEndFrom(current?.trialEndsAt ?? null, request.days, now);
      const before = current?.trialEndsAt ? ` (antes ${inclusiveEndLabel(current.trialEndsAt)})` : "";
      return {
        ok: true,
        value: {
          patch: { trialEndsAt: end },
          action: "billing.extend",
          from: "trial",
          to: "trial",
          detail: `+${plural(request.days)}: hasta el ${inclusiveEndLabel(end)}${before}`,
        },
      };
    }

    case "plan":
      if (request.plan === plan) return { ok: false, error: `Ya estaba en el plan ${PLANS[plan].name}` };
      return {
        ok: true,
        value: {
          patch: { plan: request.plan, ...(current ? {} : { status: "free" as const }) },
          action: "billing.plan",
          from: plan,
          to: request.plan,
          detail: null,
        },
      };

    case "unpaid":
      if (status === "unpaid") return { ok: false, error: "Ya estaba interrumpido por falta de pago" };
      if (status === "cancelled") return { ok: false, error: "Está dado de baja: reactivalo primero" };
      return {
        ok: true,
        value: { patch: { status: "unpaid", plan }, action: "billing.unpaid", from: status, to: "unpaid", detail: null },
      };

    case "reactivate": {
      if (status !== "unpaid" && status !== "cancelled" && status !== "past_due") {
        return { ok: false, error: `No hay nada que reactivar: está ${label(status).toLowerCase()}` };
      }
      if (request.to === "free") {
        return {
          ok: true,
          value: {
            patch: { status: "free", plan, trialEndsAt: null, cancelledAt: null },
            action: "billing.reactivate",
            from: status,
            to: "free",
            detail: "Reactivado como cortesía",
          },
        };
      }
      const days = request.days ?? DEFAULT_PAID_DAYS;
      const end = periodEndFrom(null, days, now);
      if (request.to === "trial") {
        return {
          ok: true,
          value: {
            patch: { status: "trial", plan, trialEndsAt: end, cancelledAt: null },
            action: "billing.reactivate",
            from: status,
            to: "trial",
            detail: `Reactivado en prueba de ${plural(days)}, hasta el ${inclusiveEndLabel(end)}`,
          },
        };
      }
      return {
        ok: true,
        value: {
          patch: { status: "active", plan, currentPeriodEnd: end, cancelledAt: null },
          action: "billing.reactivate",
          from: status,
          to: "active",
          detail: `Reactivado al día por ${plural(days)}, hasta el ${inclusiveEndLabel(end)}`,
        },
      };
    }

    case "cancel":
      if (status === "cancelled") return { ok: false, error: "Ya estaba dado de baja" };
      return {
        ok: true,
        value: {
          patch: { status: "cancelled", plan, cancelledAt: now.getTime() },
          action: "billing.cancel",
          from: status,
          to: "cancelled",
          detail: null,
        },
      };
  }
}

/* ------------------------------------------------------------------ */
/* Configuración global (/platform/planes)                              */
/* ------------------------------------------------------------------ */

export type BillingConfigInput = {
  prices: Record<PlanId, number>;
  newTenantMode: "free" | "trial";
  trialDays: number;
  graceDays: number;
};

export const PRICE_MAX_ARS = 10_000_000;
export const GRACE_DAYS_MAX = 60;

export function parseBillingConfigInput(raw: unknown): Check<BillingConfigInput> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Datos inválidos" };
  const input = raw as Record<string, unknown>;
  const rawPrices = (input.prices && typeof input.prices === "object" ? input.prices : {}) as Record<string, unknown>;
  const prices = {} as Record<PlanId, number>;
  for (const id of ["solo", "equipo", "pro"] as const) {
    const value = rawPrices[id];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > PRICE_MAX_ARS) {
      return { ok: false, error: `El precio del plan ${PLANS[id].name} tiene que ser un número entero de pesos (0 a ${formatMoney(PRICE_MAX_ARS)})` };
    }
    prices[id] = value;
  }
  if (input.newTenantMode !== "free" && input.newTenantMode !== "trial") return { ok: false, error: "Elegí qué reciben los locales nuevos" };
  const trialDays = validDays(input.trialDays);
  if (!trialDays.ok) return { ok: false, error: `Días de prueba: ${trialDays.error.toLowerCase()}` };
  const grace = input.graceDays;
  if (typeof grace !== "number" || !Number.isInteger(grace) || grace < 0 || grace > GRACE_DAYS_MAX) {
    return { ok: false, error: `Los días de gracia van de 0 a ${GRACE_DAYS_MAX}` };
  }
  return { ok: true, value: { prices, newTenantMode: input.newTenantMode, trialDays: trialDays.value, graceDays: grace } };
}

/** "Locales nuevos: todo gratis" / "Locales nuevos: prueba de 15 días". */
export function newTenantModeLabel(config: { newTenantMode: "free" | "trial"; trialDays: number }): string {
  return config.newTenantMode === "trial" ? `prueba de ${plural(config.trialDays)}` : "todo gratis";
}

/** Resumen de qué cambió, para la auditoría. null si no cambió nada. */
export function describeBillingConfigChange(before: BillingConfigInput, after: BillingConfigInput): string | null {
  const parts: string[] = [];
  for (const id of ["solo", "equipo", "pro"] as const) {
    if (before.prices[id] !== after.prices[id]) {
      parts.push(`${PLANS[id].name}: ${formatMoney(before.prices[id])} → ${formatMoney(after.prices[id])}`);
    }
  }
  if (before.newTenantMode !== after.newTenantMode || (after.newTenantMode === "trial" && before.trialDays !== after.trialDays)) {
    parts.push(`Locales nuevos: ${newTenantModeLabel(before)} → ${newTenantModeLabel(after)}`);
  } else if (before.trialDays !== after.trialDays) {
    parts.push(`Días de prueba: ${before.trialDays} → ${after.trialDays}`);
  }
  if (before.graceDays !== after.graceDays) parts.push(`Gracia: ${plural(before.graceDays)} → ${plural(after.graceDays)}`);
  return parts.length ? parts.join(" · ") : null;
}

/* ------------------------------------------------------------------ */
/* Eliminar local                                                       */
/* ------------------------------------------------------------------ */

/**
 * Doble seguro: solo se borra un local que YA está apagado o dado de baja
 * (primero se lo saca de servicio, después se lo borra), y escribiendo su
 * URL exacta. `typed` se compara sin espacios a los costados, nada más.
 */
export function checkTenantDeletion(input: {
  tenantStatus: string;
  billingStatus: BillingStatus | null;
  slug: string;
  tenantId: string;
  typed: unknown;
}): Check<true> {
  if (input.tenantStatus !== "suspended" && input.billingStatus !== "cancelled") {
    return { ok: false, error: "Primero apagalo o dalo de baja: solo se elimina un local que ya está fuera de servicio" };
  }
  const expected = input.slug || input.tenantId;
  if (typeof input.typed !== "string" || input.typed.trim() !== expected) {
    return { ok: false, error: `Escribí exactamente "${expected}" para confirmar` };
  }
  return { ok: true, value: true };
}
