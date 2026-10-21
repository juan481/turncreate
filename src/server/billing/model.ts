// Lógica pura de la suscripción del local a TurnCreate (lo que el local le
// paga a Just Create por Mercado Pago "Suscripciones" / preapproval).
// Sin Firestore, sin Next, sin SDK de MP: la usan config.ts, tenant-billing.ts,
// subscriptions.ts y webhook.ts, y se testea en model.test.ts.
//
// Todas las fechas en milisegundos epoch. La conversión a/desde Timestamp
// de Firestore vive en tenant-billing.ts.
import { BILLING_STATUSES, DEFAULT_GRACE_DAYS, type BillingStatus, type TenantBilling } from "@/lib/billing";
import { DEFAULT_PLAN_PRICES_ARS, isPlanId, PLAN_IDS, type PlanId } from "@/lib/plans";

export const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Config global (platformConfig/billing)
// ---------------------------------------------------------------------------

export type BillingConfig = {
  prices: Record<PlanId, number>;
  newTenantMode: "free" | "trial";
  trialDays: number;
  graceDays: number;
};

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  prices: { ...DEFAULT_PLAN_PRICES_ARS },
  newTenantMode: "free",
  trialDays: 7,
  graceDays: DEFAULT_GRACE_DAYS,
};

export const PRICE_MIN = 1;
export const PRICE_MAX = 10_000_000;
export const TRIAL_DAYS_MIN = 1;
export const TRIAL_DAYS_MAX = 365;
export const GRACE_DAYS_MIN = 0;
export const GRACE_DAYS_MAX = 30;

function intInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Lee platformConfig/billing tolerando datos viejos o rotos: cada campo
 * inválido cae a su default (el turnero nunca se rompe por un doc mal cargado).
 */
export function parseBillingConfig(data: unknown): BillingConfig {
  const raw = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawPrices = (raw.prices && typeof raw.prices === "object" ? raw.prices : {}) as Record<string, unknown>;
  const prices = { ...DEFAULT_BILLING_CONFIG.prices };
  for (const plan of PLAN_IDS) {
    const value = rawPrices[plan];
    if (intInRange(value, PRICE_MIN, PRICE_MAX)) prices[plan] = value;
  }
  return {
    prices,
    newTenantMode: raw.newTenantMode === "trial" ? "trial" : "free",
    trialDays: intInRange(raw.trialDays, TRIAL_DAYS_MIN, TRIAL_DAYS_MAX) ? raw.trialDays : DEFAULT_BILLING_CONFIG.trialDays,
    graceDays: intInRange(raw.graceDays, GRACE_DAYS_MIN, GRACE_DAYS_MAX) ? raw.graceDays : DEFAULT_BILLING_CONFIG.graceDays,
  };
}

/**
 * Valida un cambio de config desde /platform. Tira con un mensaje para la UI
 * ante el primer valor inválido; devuelve solo los campos presentes (los
 * precios pueden venir parciales: `{ prices: { pro: 59900 } }`).
 */
export function validateBillingConfigPatch(patch: unknown): Partial<Omit<BillingConfig, "prices">> & { prices?: Partial<Record<PlanId, number>> } {
  if (!patch || typeof patch !== "object") throw new Error("Configuración inválida");
  const input = patch as Record<string, unknown>;
  const out: Partial<Omit<BillingConfig, "prices">> & { prices?: Partial<Record<PlanId, number>> } = {};
  if (input.prices !== undefined) {
    if (!input.prices || typeof input.prices !== "object") throw new Error("Precios inválidos");
    const prices: Partial<Record<PlanId, number>> = {};
    for (const [plan, value] of Object.entries(input.prices as Record<string, unknown>)) {
      if (!isPlanId(plan)) throw new Error(`Plan desconocido: ${plan}`);
      if (!intInRange(value, PRICE_MIN, PRICE_MAX)) {
        throw new Error(`El precio del plan ${plan} tiene que ser un número entero entre ${PRICE_MIN} y ${PRICE_MAX.toLocaleString("es-AR")}`);
      }
      prices[plan] = value;
    }
    out.prices = prices;
  }
  if (input.newTenantMode !== undefined) {
    if (input.newTenantMode !== "free" && input.newTenantMode !== "trial") throw new Error("El modo de alta tiene que ser free o trial");
    out.newTenantMode = input.newTenantMode;
  }
  if (input.trialDays !== undefined) {
    if (!intInRange(input.trialDays, TRIAL_DAYS_MIN, TRIAL_DAYS_MAX)) throw new Error(`Los días de prueba van de ${TRIAL_DAYS_MIN} a ${TRIAL_DAYS_MAX}`);
    out.trialDays = input.trialDays;
  }
  if (input.graceDays !== undefined) {
    if (!intInRange(input.graceDays, GRACE_DAYS_MIN, GRACE_DAYS_MAX)) throw new Error(`Los días de gracia van de ${GRACE_DAYS_MIN} a ${GRACE_DAYS_MAX}`);
    out.graceDays = input.graceDays;
  }
  return out;
}

// ---------------------------------------------------------------------------
// tenants/{id}.billing
// ---------------------------------------------------------------------------

/** Timestamp de Firestore (duck typing: este módulo no importa firebase-admin), Date, número o ISO → ms. */
export function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "object" && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function isBillingStatus(value: unknown): value is BillingStatus {
  return typeof value === "string" && (BILLING_STATUSES as string[]).includes(value);
}

/**
 * `tenants/{id}` → TenantBilling en ms (lee `tenantData.billing`).
 * null si no hay billing o el status es desconocido (= free para billingAccess,
 * nadie pierde acceso por un dato roto). Sin plan válido en billing se usa el
 * `plan` del local, y si tampoco hay, Equipo (mismo default que planFeatures).
 */
export function readTenantBilling(tenantData: unknown): TenantBilling | null {
  if (!tenantData || typeof tenantData !== "object") return null;
  const record = tenantData as Record<string, unknown>;
  const raw = (record.billing && typeof record.billing === "object" ? record.billing : null) as Record<string, unknown> | null;
  if (!raw || !isBillingStatus(raw.status)) return null;
  const plan: PlanId = isPlanId(raw.plan) ? raw.plan : isPlanId(record.plan) ? record.plan : "equipo";
  const graceDays = typeof raw.graceDays === "number" && Number.isFinite(raw.graceDays) ? raw.graceDays : null;
  return {
    status: raw.status,
    plan,
    trialEndsAt: toMillis(raw.trialEndsAt),
    currentPeriodEnd: toMillis(raw.currentPeriodEnd),
    graceDays,
    mpPreapprovalId: optionalString(raw.mpPreapprovalId),
    mpPreapprovalStatus: optionalString(raw.mpPreapprovalStatus),
    payerEmail: optionalString(raw.payerEmail),
    cancelledAt: toMillis(raw.cancelledAt),
    cancelAtPeriodEnd: raw.cancelAtPeriodEnd === true,
  };
}

/** Billing de un local recién creado según la config vigente (en ms). */
export function initialBilling(config: BillingConfig, plan: PlanId, now: number): TenantBilling {
  if (config.newTenantMode === "trial") {
    return { status: "trial", plan, trialEndsAt: now + config.trialDays * DAY_MS, currentPeriodEnd: null, graceDays: config.graceDays };
  }
  return { status: "free", plan, trialEndsAt: null, currentPeriodEnd: null, graceDays: config.graceDays };
}

// ---------------------------------------------------------------------------
// Mercado Pago
// ---------------------------------------------------------------------------

export const EXTERNAL_REFERENCE_PREFIX = "tcsub_";

export function subscriptionExternalReference(tenantId: string) {
  return `${EXTERNAL_REFERENCE_PREFIX}${tenantId}`;
}

const TENANT_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function tenantIdFromExternalReference(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(EXTERNAL_REFERENCE_PREFIX)) return null;
  const id = value.slice(EXTERNAL_REFERENCE_PREFIX.length);
  return TENANT_ID.test(id) ? id : null;
}

export type SubscriptionTopic = "preapproval" | "authorized_payment";

/**
 * Tópico de la notificación → qué recurso hay que ir a buscar a MP.
 * Webhooks nuevos: subscription_preapproval / subscription_authorized_payment.
 * IPN/feeds viejos: preapproval / authorized_payment.
 * subscription_preapproval_plan no aplica (las suscripciones son sin plan).
 */
export function subscriptionTopic(type: unknown): SubscriptionTopic | null {
  if (type === "subscription_preapproval" || type === "preapproval") return "preapproval";
  if (type === "subscription_authorized_payment" || type === "authorized_payment") return "authorized_payment";
  return null;
}

/** Suma meses de calendario (31/1 + 1 mes = 28/2 o 29/2, nunca 3/3). */
export function addMonths(ms: number, months: number): number {
  const date = new Date(ms);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

/**
 * Margen sobre la fecha de cobro de MP: el débito se procesa durante el día
 * (y el aviso puede tardar unas horas), así un cobro puntual no muestra el
 * cartel de "pago vencido" mientras tanto.
 */
export const CHARGE_LAG_BUFFER_MS = DAY_MS;

/**
 * Hasta cuándo queda cubierto el local con un cobro aprobado. Si MP informa
 * `next_payment_date` (posterior al pago) manda esa fecha + margen; si no,
 * max(fin actual, fecha del pago) + 1 mes. Nunca acorta un período ya pago.
 */
export function periodEndAfterPayment(input: { existingEnd: number | null | undefined; paidAt: number; nextPaymentDate: number | null | undefined }): number {
  const existing = input.existingEnd ?? 0;
  const target = input.nextPaymentDate != null && input.nextPaymentDate > input.paidAt
    ? input.nextPaymentDate + CHARGE_LAG_BUFFER_MS
    : addMonths(Math.max(existing, input.paidAt), 1);
  return Math.max(existing, target);
}

/**
 * Hasta cuándo el local ya tiene acceso pago/de prueba (para que la suscripción
 * nueva arranque a cobrar recién ahí y no pague dos veces lo mismo). null si
 * no queda nada por delante y MP tiene que cobrar ya.
 */
export function paidThrough(billing: TenantBilling | null, now: number): number | null {
  if (!billing) return null;
  const end = billing.status === "trial" ? billing.trialEndsAt : billing.status === "active" ? billing.currentPeriodEnd : null;
  // Menos de una hora no vale la pena: MP exige start_date futuro.
  return end != null && end - now > 60 * 60 * 1000 ? end : null;
}

/** Cómo arrancar el checkout de un plan según lo que el local ya tiene en MP. */
export type CheckoutPlan =
  | { kind: "already_subscribed" }
  /** Suscripción autorizada y al día: se cambia el monto en el mismo preapproval (sin pasar por MP). */
  | { kind: "change_plan"; preapprovalId: string }
  /** Preapproval nuevo; `replacePreapprovalId` se cancela en MP (pendiente, pausado o el de una tarjeta rechazada). */
  | { kind: "new"; replacePreapprovalId: string | null; startDate: number | null };

export function planCheckout(billing: TenantBilling | null, plan: PlanId, now: number): CheckoutPlan {
  const previousId = billing?.mpPreapprovalId ?? null;
  const previousStatus = billing?.mpPreapprovalStatus ?? null;
  const live = previousId && previousStatus === "authorized";
  if (live && billing && billing.status === "active" && !billing.cancelAtPeriodEnd) {
    return billing.plan === plan ? { kind: "already_subscribed" } : { kind: "change_plan", preapprovalId: previousId };
  }
  const replace = previousId && previousStatus !== "cancelled" ? previousId : null;
  return { kind: "new", replacePreapprovalId: replace, startDate: paidThrough(billing, now) };
}

/** Patch sobre tenants/{id}.billing (en ms; null borra). `plan` también se copia al `plan` del local. */
export type BillingPatch = Partial<TenantBilling>;

export type PreapprovalSnapshot = {
  id: string;
  status: string;
  nextPaymentDate: number | null;
  payerEmail: string | null;
};

/**
 * Qué cambia en el billing del local cuando MP avisa un cambio del preapproval.
 * null = nada que hacer (por ejemplo, un preapproval viejo que ya se reemplazó).
 *
 * - authorized: la dueña aceptó el débito automático. Si venía de prueba/
 *   cortesía/baja pasa a `active` con un período provisorio hasta el primer
 *   cobro (+1 día de margen); el cobro aprobado (authorized_payment) lo extiende.
 *   Si estaba past_due solo se registra: recién el cobro aprobado lo regulariza.
 * - cancelled: si estaba al día queda `cancelAtPeriodEnd` (sigue activo hasta
 *   currentPeriodEnd y después solo lectura); si debía, la gracia sigue su curso.
 * - paused / pending: solo se registra el estado; si no hay cobros el período
 *   vence solo (active → gracia → solo lectura).
 */
export function preapprovalTransition(current: TenantBilling | null, preapproval: PreapprovalSnapshot, now: number, graceDays: number): BillingPatch | null {
  const isCurrent = current?.mpPreapprovalId === preapproval.id;
  const adopt = !isCurrent && preapproval.status === "authorized" && current?.mpPreapprovalStatus !== "authorized";
  if (!isCurrent && !adopt) return null;

  const base: BillingPatch = { mpPreapprovalId: preapproval.id, mpPreapprovalStatus: preapproval.status };
  if (preapproval.payerEmail) base.payerEmail = preapproval.payerEmail;

  if (preapproval.status === "authorized") {
    const newlyAuthorized = adopt || current?.mpPreapprovalStatus !== "authorized" || current?.cancelAtPeriodEnd === true;
    if (!newlyAuthorized) return base;
    const patch: BillingPatch = { ...base, cancelAtPeriodEnd: false, cancelledAt: null, graceDays };
    if (current?.status === "past_due") return patch;
    const covered = paidThrough(current, now) ?? 0;
    const firstCharge = preapproval.nextPaymentDate ?? now;
    return {
      ...patch,
      // El plan elegido en el checkout pasa a ser el del local (planFeatures).
      ...(current ? { plan: current.plan } : {}),
      status: "active",
      trialEndsAt: null,
      currentPeriodEnd: Math.max(covered, firstCharge + CHARGE_LAG_BUFFER_MS),
    };
  }

  if (preapproval.status === "cancelled") {
    if (current?.status === "active" && !current.cancelAtPeriodEnd) {
      return { ...base, cancelAtPeriodEnd: true, cancelledAt: now };
    }
    return base;
  }

  return base;
}

export type AuthorizedPaymentSnapshot = {
  /** id del authorized_payment (la "factura" de la cuota). */
  id: string;
  preapprovalId: string | null;
  /** scheduled | processed | recycling | cancelled | ... */
  status: string;
  paymentId: string | null;
  /** approved | rejected | in_process | ... (el cobro concreto de la cuota) */
  paymentStatus: string | null;
  amount: number;
  currency: string | null;
  /** Fecha del débito (o de creación) en ms. */
  chargedAt: number | null;
};

export type BillingPaymentRecord = {
  amount: number;
  currency: string;
  status: "approved" | "rejected";
  mpId: string;
  mpPaymentId: string | null;
  preapprovalId: string | null;
  paidAt: number;
};

/** Si el período pago llega más allá de esto, un rechazo es un aviso viejo (otra cuota ya se cobró). */
export const STALE_REJECTION_MARGIN_MS = 3 * DAY_MS;

const REJECTED_PAYMENT = new Set(["rejected", "cancelled"]);

/**
 * Qué cambia cuando MP avisa una cuota (authorized_payment).
 * - cobro aprobado → `active` y el período se extiende (periodEndAfterPayment).
 * - cobro rechazado / cuota en reintento (recycling) → `past_due` si estaba
 *   activo y el período está por vencer (un rechazo viejo que llega después de
 *   un cobro aprobado no baja al local).
 * - el resto (scheduled, en proceso) no cambia nada.
 */
export function authorizedPaymentTransition(
  current: TenantBilling | null,
  invoice: AuthorizedPaymentSnapshot,
  context: { now: number; graceDays: number; nextPaymentDate: number | null },
): { patch: BillingPatch | null; payment: BillingPaymentRecord | null } {
  const chargedAt = invoice.chargedAt ?? context.now;
  const record = (status: BillingPaymentRecord["status"]): BillingPaymentRecord => ({
    amount: invoice.amount,
    currency: invoice.currency ?? "ARS",
    status,
    mpId: invoice.id,
    mpPaymentId: invoice.paymentId,
    preapprovalId: invoice.preapprovalId,
    paidAt: chargedAt,
  });

  if (invoice.paymentStatus === "approved") {
    const existingEnd = current && (current.status === "active" || current.status === "past_due") ? current.currentPeriodEnd : null;
    return {
      patch: {
        status: "active",
        trialEndsAt: null,
        graceDays: context.graceDays,
        currentPeriodEnd: periodEndAfterPayment({ existingEnd, paidAt: chargedAt, nextPaymentDate: context.nextPaymentDate }),
      },
      payment: record("approved"),
    };
  }

  const rejected = (invoice.paymentStatus != null && REJECTED_PAYMENT.has(invoice.paymentStatus)) || invoice.status === "recycling";
  if (!rejected) return { patch: null, payment: null };
  const payment = invoice.paymentId || invoice.paymentStatus ? record("rejected") : null;
  if (current?.status !== "active") return { patch: null, payment };
  const end = current.currentPeriodEnd;
  if (end != null && end > context.now + STALE_REJECTION_MARGIN_MS) return { patch: null, payment };
  return { patch: { status: "past_due", graceDays: context.graceDays }, payment };
}

/** Id de doc de Firestore seguro a partir de partes de MP (sin "/", acotado). */
export function billingEventId(parts: (string | number | null | undefined)[]): string {
  return parts
    .map((part) => String(part ?? "na"))
    .join("_")
    .replace(/[^A-Za-z0-9_.:-]/g, "-")
    .slice(0, 400);
}
