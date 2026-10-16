import { BILLING_STATUS_LABEL, type BillingStatus } from "@/lib/billing";
import { PLANS } from "@/lib/plans";
import { addDaysISO, formatInTz, parseDateISO, startOfDayInTz, toDateISOInTz, todayISO } from "@/lib/dates";

/**
 * Lógica pura de la consola de plataforma (/platform): sin Firestore ni
 * "server-only", para poder testearla sola y usarla también desde el
 * listado cliente (búsqueda/filtro). Las lecturas viven en ./stats.ts y
 * ./audit.ts; las escrituras, en las Server Actions de (platform).
 */

/** La consola mira todo en hora argentina (la del dueño de la plataforma). */
export const PLATFORM_TZ = "America/Argentina/Buenos_Aires";

/* ------------------------------------------------------------------ */
/* Ids y estados                                                        */
/* ------------------------------------------------------------------ */

/** Mismo criterio que los ID_PATTERN del turnero público: ids auto de Firestore y los del seed. */
export const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function isValidTenantId(value: unknown): value is string {
  return typeof value === "string" && TENANT_ID_PATTERN.test(value);
}

export type TenantStatus = "trial" | "active" | "suspended";

/** Sin dato (o basura) = "trial", igual que lo crea createTenantForOwner. */
export function normalizeTenantStatus(value: unknown): TenantStatus {
  return value === "active" || value === "suspended" ? value : "trial";
}

// "trial" es el estado con el que nace un local (createTenantForOwner), no la
// prueba de la suscripción (eso vive en billing.status): por eso "Nuevo".
export const TENANT_STATUS_LABEL: Record<TenantStatus, string> = {
  trial: "Nuevo",
  active: "Activo",
  suspended: "Apagado",
};

export type PlatformTone = "confirmed" | "pending" | "alert" | "draft";

export function tenantStatusTone(status: TenantStatus): PlatformTone {
  if (status === "active") return "confirmed";
  if (status === "suspended") return "alert";
  return "pending";
}

/** "Prendido" = cualquier estado menos suspendido (en prueba también atiende). */
export function isTenantOn(status: TenantStatus): boolean {
  return status !== "suspended";
}

/** Los locales anteriores a los planes no tienen `plan` y funcionan como Equipo (ver lib/plans.ts). */
export function planLabel(plan: unknown): string {
  if (plan === "solo" || plan === "equipo" || plan === "pro") return PLANS[plan].name;
  return "Equipo (sin plan)";
}

/** "Sin seña" / "$10.000 fija" / "30%" -- de settings.depositType/depositValue. */
export function depositLabel(settings: { depositType?: unknown; depositValue?: unknown } | null | undefined): string {
  const value = Number(settings?.depositValue ?? 0);
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  if (settings?.depositType === "fixed" && safe > 0) return `${formatMoney(safe)} fija`;
  if (settings?.depositType === "percent" && safe > 0) return `${safe.toLocaleString("es-AR")}%`;
  return "Sin seña";
}

/* ------------------------------------------------------------------ */
/* Búsqueda, filtro y totales del listado                               */
/* ------------------------------------------------------------------ */

/** "demo" = los locales de muestra (isDemo), que no cuentan en los totales. */
export type StatusFilter = "all" | TenantStatus | "demo";
export const STATUS_FILTERS: readonly StatusFilter[] = ["all", "active", "trial", "suspended", "demo"];

/** Minúsculas y sin tildes: "Peluquería" lo encuentra "peluqueria". */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

type FilterableRow = { name: string; slug: string; ownerEmail: string | null; status: TenantStatus; isDemo?: boolean; billingFilter?: string };

/** `billing`: una clave de BILLING_FILTERS (billing-model.ts) o "all". */
export function filterTenants<T extends FilterableRow>(
  rows: readonly T[],
  query: string,
  status: StatusFilter,
  billing: string = "all",
): T[] {
  const needle = normalizeSearch(query);
  return rows.filter((row) => {
    if (status === "demo" ? !row.isDemo : status !== "all" && row.status !== status) return false;
    if (billing !== "all" && row.billingFilter !== billing) return false;
    if (!needle) return true;
    return [row.name, row.slug, row.ownerEmail ?? ""].some((field) => normalizeSearch(field).includes(needle));
  });
}

export type TenantTotals = {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  bookingOn: number;
  appointments30d: number;
  /** Locales demo: se cuentan aparte y NO entran en ninguno de los totales de arriba. */
  demo: number;
};

/** Totales de la plataforma SIN los locales demo (con ellos "turnos cargados" se inflaba). */
export function summarizeTenantRows(
  rows: Iterable<{ status: TenantStatus; bookingEnabled: boolean; appointments30d: number; isDemo?: boolean }>,
): TenantTotals {
  const totals: TenantTotals = { total: 0, active: 0, trial: 0, suspended: 0, bookingOn: 0, appointments30d: 0, demo: 0 };
  for (const row of rows) {
    if (row.isDemo) {
      totals.demo += 1;
      continue;
    }
    totals.total += 1;
    totals[row.status] += 1;
    // Un turnero "prendido" en un local apagado no toma reservas: no cuenta.
    if (row.bookingEnabled && isTenantOn(row.status)) totals.bookingOn += 1;
    totals.appointments30d += Number.isFinite(row.appointments30d) ? row.appointments30d : 0;
  }
  return totals;
}

/* ------------------------------------------------------------------ */
/* Motivo + transiciones de estado (lo valida la Server Action)         */
/* ------------------------------------------------------------------ */

export const REASON_MIN_LENGTH = 5;
export const REASON_MAX_LENGTH = 500;

export type Check<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Motivo para la auditoría: sin caracteres de control, espacios colapsados.
 * `required` = apagar (local o turnero): sin motivo no queda registro útil.
 */
export function validateReason(raw: unknown, required: boolean): Check<string | null> {
  if (raw !== undefined && raw !== null && typeof raw !== "string") return { ok: false, error: "El motivo no es válido" };
  const reason = typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";
  if (reason.length > REASON_MAX_LENGTH) return { ok: false, error: `El motivo puede tener hasta ${REASON_MAX_LENGTH} caracteres` };
  if (!reason) return required ? { ok: false, error: "Contá por qué lo apagás: queda en la auditoría" } : { ok: true, value: null };
  if (reason.length < REASON_MIN_LENGTH) return { ok: false, error: `El motivo tiene que tener al menos ${REASON_MIN_LENGTH} caracteres` };
  return { ok: true, value: reason };
}

export type AuditAction =
  | "tenant.suspend"
  | "tenant.activate"
  | "tenant.booking_off"
  | "tenant.booking_on"
  | "tenant.demo_on"
  | "tenant.demo_off"
  | "tenant.delete"
  | "billing.free"
  | "billing.trial"
  | "billing.extend"
  | "billing.plan"
  | "billing.unpaid"
  | "billing.reactivate"
  | "billing.cancel"
  | "billing.sync"
  | "config.billing";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  "tenant.suspend": "Local apagado",
  "tenant.activate": "Local prendido",
  "tenant.booking_off": "Turnero apagado",
  "tenant.booking_on": "Turnero prendido",
  "tenant.demo_on": "Marcado como demo",
  "tenant.demo_off": "Ya no es demo",
  "tenant.delete": "Local eliminado",
  "billing.free": "Cortesía",
  "billing.trial": "Prueba iniciada",
  "billing.extend": "Prueba extendida",
  "billing.plan": "Cambio de plan",
  "billing.unpaid": "Interrumpido por falta de pago",
  "billing.reactivate": "Suscripción reactivada",
  "billing.cancel": "Dado de baja",
  "billing.sync": "Sincronizado con Mercado Pago",
  "config.billing": "Precios y planes",
};

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === "string" && value in AUDIT_ACTION_LABEL;
}

export function auditActionTone(action: AuditAction): PlatformTone {
  switch (action) {
    case "tenant.suspend":
    case "tenant.delete":
    case "billing.unpaid":
    case "billing.cancel":
      return "alert";
    case "tenant.booking_off":
    case "tenant.demo_on":
    case "tenant.demo_off":
      return "draft";
    case "billing.trial":
    case "billing.extend":
    case "billing.plan":
    case "billing.sync":
    case "config.billing":
      return "pending";
    default:
      return "confirmed";
  }
}

function isBillingStatusValue(value: string): value is BillingStatus {
  return value in BILLING_STATUS_LABEL;
}

/** "De X a Y" de una fila de auditoría; null si la acción no tiene un antes/después que mostrar. */
export function auditChangeLabel(entry: { action: AuditAction; from: string; to: string }): string | null {
  const { action, from, to } = entry;
  if (action === "tenant.booking_on" || action === "tenant.booking_off") {
    return `De ${from === "on" ? "prendido" : "apagado"} a ${to === "on" ? "prendido" : "apagado"}`;
  }
  if (action === "tenant.suspend" || action === "tenant.activate") {
    const label = (value: string) => TENANT_STATUS_LABEL[normalizeTenantStatus(value)].toLowerCase();
    return `De ${label(from)} a ${label(to)}`;
  }
  if (action === "billing.plan") return `De ${planLabel(from)} a ${planLabel(to)}`;
  if (action.startsWith("billing.") && from !== to && isBillingStatusValue(from) && isBillingStatusValue(to)) {
    return `De ${BILLING_STATUS_LABEL[from].toLowerCase()} a ${BILLING_STATUS_LABEL[to].toLowerCase()}`;
  }
  return null;
}

export type StatusChange = { from: TenantStatus; to: "active" | "suspended"; action: "tenant.suspend" | "tenant.activate" };

/**
 * `current` sale SIEMPRE de la lectura del servidor (dentro de la
 * transacción), nunca de lo que mandó el cliente: el botón viejo
 * "Suspender" invertía el estado que le pasaba la pantalla, y con dos
 * pestañas abiertas (o un doble click) prendía lo que se quería apagar.
 */
export function planStatusChange(current: TenantStatus, next: unknown): Check<StatusChange> {
  if (next !== "active" && next !== "suspended") return { ok: false, error: "Estado inválido" };
  if (current === next) {
    return { ok: false, error: next === "suspended" ? "El local ya estaba apagado" : "El local ya estaba activo" };
  }
  return { ok: true, value: { from: current, to: next, action: next === "suspended" ? "tenant.suspend" : "tenant.activate" } };
}

export type BookingChange = { from: "on" | "off"; to: "on" | "off"; action: "tenant.booking_off" | "tenant.booking_on" };

/** Mismo criterio que el turnero: sin dato = prendido (`publicBookingEnabled !== false`). */
export function isBookingEnabled(settings: { publicBookingEnabled?: unknown } | null | undefined): boolean {
  return settings?.publicBookingEnabled !== false;
}

export function planBookingChange(currentEnabled: boolean, next: unknown): Check<BookingChange> {
  if (typeof next !== "boolean") return { ok: false, error: "Valor inválido" };
  if (currentEnabled === next) {
    return { ok: false, error: next ? "El turnero ya estaba prendido" : "El turnero ya estaba apagado" };
  }
  return {
    ok: true,
    value: { from: currentEnabled ? "on" : "off", to: next ? "on" : "off", action: next ? "tenant.booking_on" : "tenant.booking_off" },
  };
}

/* ------------------------------------------------------------------ */
/* Ids de auditoría ordenables                                          */
/* ------------------------------------------------------------------ */

const AUDIT_ID_MAX_MS = 9_999_999_999_999;

/**
 * Id de `platformAudit` que ordena de más nuevo a más viejo por orden
 * ALFABÉTICO de id. Así la auditoría de UN local sale con
 * `where("tenantId", "==", id).limit(n)` (índice automático de un solo
 * campo, que ya desempata por id) sin pedir el índice compuesto
 * (tenantId ASC, at DESC) -- en producción los índices son obligatorios.
 */
export function auditDocId(at: Date, suffix: string): string {
  const ms = Math.max(0, Math.min(AUDIT_ID_MAX_MS, at.getTime()));
  const safeSuffix = suffix.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) || "x";
  return `${String(AUDIT_ID_MAX_MS - ms).padStart(13, "0")}_${safeSuffix}`;
}

/* ------------------------------------------------------------------ */
/* Fechas y plata                                                       */
/* ------------------------------------------------------------------ */

/** Timestamp de Firestore / Date / nada -> Date | null. */
export function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  return null;
}

/**
 * Inicio de una ventana de `days` días calendario que INCLUYE hoy, en la
 * zona del local: "últimos 30 días" = hoy + los 29 anteriores, desde las
 * 00:00. Mismo criterio que la analítica diaria (14 días con hoy).
 */
export function rollingWindowStart(days: number, timezone: string, now: Date = new Date()): Date {
  const safeDays = Math.max(1, Math.floor(days));
  return startOfDayInTz(addDaysISO(todayISO(timezone, now), -(safeDays - 1)), timezone);
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = parseDateISO(fromISO);
  const [ty, tm, td] = parseDateISO(toISO);
  return Math.round((Date.UTC(ty, tm, td) - Date.UTC(fy, fm, fd)) / 86_400_000);
}

/** Días calendario entre el instante y hoy, en `timezone` (0 = hoy). null si no hay instante. */
export function daysAgo(instant: Date | null, now: Date = new Date(), timezone = PLATFORM_TZ): number | null {
  if (!instant) return null;
  return Math.max(0, daysBetweenISO(toDateISOInTz(instant, timezone), todayISO(timezone, now)));
}

/** "Hoy" / "Ayer" / "Hace 5 días" / "Hace 2 meses" / "Sin turnos todavía". */
export function relativeActivityLabel(instant: Date | null, now: Date = new Date(), timezone = PLATFORM_TZ): string {
  const days = daysAgo(instant, now, timezone);
  if (days === null) return "Sin turnos todavía";
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
  }
  return "Hace más de un año";
}

/** Verde = movió algo en la semana, ámbar = en el mes, rojo = más de un mes quieto (o nunca). */
export function activityTone(instant: Date | null, now: Date = new Date(), timezone = PLATFORM_TZ): PlatformTone {
  const days = daysAgo(instant, now, timezone);
  if (days === null || days > 30) return "alert";
  if (days > 7) return "draft";
  return "confirmed";
}

const DATE_LABEL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
const DATE_TIME_LABEL: Intl.DateTimeFormatOptions = { ...DATE_LABEL, hour: "2-digit", minute: "2-digit", hour12: false };

/** "16/10/2026" en hora argentina; "—" sin fecha. */
export function platformDateLabel(instant: Date | string | null): string {
  return instant ? formatInTz(instant, PLATFORM_TZ, DATE_LABEL) : "—";
}

/** "16/10/2026, 14:32" en hora argentina; "—" sin fecha. */
export function platformDateTimeLabel(instant: Date | string | null): string {
  return instant ? formatInTz(instant, PLATFORM_TZ, DATE_TIME_LABEL) : "—";
}

export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `$${safe.toLocaleString("es-AR")}`;
}

/** Para un KpiTile a 320px: "$1,25 M" (el valor completo va en `title`). */
export function compactMoney(amount: number): string {
  if (!Number.isFinite(amount) || Math.abs(amount) < 1_000_000) return formatMoney(amount);
  return `$${(amount / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} M`;
}
