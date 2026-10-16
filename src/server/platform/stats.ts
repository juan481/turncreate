import "server-only";
import type { DocumentReference } from "firebase-admin/firestore";
import { dayRange, todayISO } from "@/lib/dates";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getPayments } from "@/server/firebase/stats";
import { summarizePayments } from "@/server/firebase/stats-model";
import type { TenantRecord } from "@/server/firebase/tenants";
import { getPlatformAnalytics, getTenantAnalyticsRange, type AnalyticsRange } from "@/server/analytics";
import { buildAnalyticsRange, mergeAnalyticsRanges } from "@/server/analytics/model";
import { bookingAvailability, isTransferReady } from "@/server/public-booking/payment-methods";
import { BILLING_STATUS_LABEL, type BillingAccess, type BillingStatus, type TenantBilling } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/plans";
import { readTenantBilling, tenantBillingAccess } from "@/server/billing/tenant-billing";
import {
  billingAccessSummary,
  billingBadge,
  billingPlanOf,
  inclusiveEndLabel,
  type BillingBadge,
  type BillingFilterKey,
} from "./billing-model";
import {
  PLATFORM_TZ,
  activityTone,
  depositLabel,
  isBookingEnabled,
  normalizeTenantStatus,
  planLabel,
  platformDateLabel,
  platformDateTimeLabel,
  relativeActivityLabel,
  rollingWindowStart,
  toDateOrNull,
  type PlatformTone,
  type TenantStatus,
} from "./model";

/**
 * Lecturas de la consola de plataforma. Reglas (producción exige índices,
 * el emulador no):
 *  - subcolecciones de un local: solo filtros/orden de UN campo (índice
 *    automático) o `count()` sobre eso;
 *  - pagos: el índice compuesto que ya existe, payments(tenantId, paidAt),
 *    vía getPayments() de stats.ts;
 *  - nada de collectionGroup nuevo.
 * Por eso "turnos de la plataforma" es la suma de un count() por local, no
 * un collectionGroup("appointments") sobre createdAt.
 */

type Owner = { email: string | null; name: string | null };

/**
 * Dueña del local: el primer member con role "owner" (preferentemente
 * activo) -> users/{uid}. Igualdad sobre un campo: índice automático.
 */
async function ownerOf(tenantRef: DocumentReference): Promise<Owner> {
  const members = await tenantRef.collection("members").where("role", "==", "owner").limit(5).get();
  const member = members.docs.find((doc) => doc.data().status === "active") ?? members.docs[0];
  if (!member) return { email: null, name: null };
  const uid = String(member.data().uid ?? member.id);
  const user = (await firebaseAdmin().db.collection("users").doc(uid).get()).data();
  const email = typeof user?.email === "string" && user.email ? user.email
    : typeof user?.contactEmail === "string" && user.contactEmail ? user.contactEmail : null;
  const name = typeof user?.fullName === "string" && user.fullName.trim() ? user.fullName.trim() : null;
  return { email, name };
}

/** Último turno cargado (por cualquier canal): orderBy de un solo campo. */
async function lastAppointmentAt(tenantRef: DocumentReference): Promise<Date | null> {
  const snapshot = await tenantRef.collection("appointments").orderBy("createdAt", "desc").limit(1).select("createdAt").get();
  return toDateOrNull(snapshot.docs[0]?.data().createdAt);
}

async function countCreatedSince(tenantRef: DocumentReference, since: Date): Promise<number> {
  const snapshot = await tenantRef.collection("appointments").where("createdAt", ">=", since).count().get();
  return snapshot.data().count;
}

async function mpStatusOf(tenantRef: DocumentReference): Promise<MpStatus> {
  const snapshot = await tenantRef.collection("integrations").doc("mercadopago").get();
  if (!snapshot.exists) return "none";
  const status = snapshot.data()?.status;
  return status === "connected" || status === "reconnect_required" ? status : "disconnected";
}

export type MpStatus = "connected" | "reconnect_required" | "disconnected" | "none";

/**
 * Suscripción del local según el contrato de src/server/billing (readTenantBilling
 * pasa las fechas a ms; tenantBillingAccess aplica la gracia). `await` en las
 * dos: funciona igual si son sync o async.
 */
async function billingOf(data: Record<string, unknown>): Promise<{ billing: TenantBilling | null; access: BillingAccess }> {
  const [billing, access] = await Promise.all([readTenantBilling(data), tenantBillingAccess(data)]);
  return { billing: billing ?? null, access };
}

/* ------------------------------------------------------------------ */
/* Listado                                                              */
/* ------------------------------------------------------------------ */

export type PlatformTenantRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  ownerEmail: string | null;
  bookingEnabled: boolean;
  mpConnected: boolean;
  appointments30d: number;
  lastActivityLabel: string;
  lastActivityTone: PlatformTone;
  createdLabel: string;
  views14d: number;
  confirmed14d: number;
  conversion14d: number;
  isDemo: boolean;
  billingLabel: string;
  billingTone: PlatformTone;
  billingFilter: BillingFilterKey;
};

export type PlatformOverview = {
  rows: PlatformTenantRow[];
  /** Embudo y visitas SIN los locales demo. */
  analytics: AnalyticsRange;
};

const LIST_FIELDS = ["name", "slug", "status", "plan", "timezone", "createdAt", "settings.publicBookingEnabled", "billing", "isDemo"] as const;
const BATCH_SIZE = 10;

/**
 * Todos los locales + su uso. Lecturas por local: dueña (2), MP (1),
 * count de turnos 30 días (1 cada 1000 turnos), último turno (1) y la
 * analítica de 14 días (1 por día con datos, mínimo 1). Lotes de 10 para
 * no abrir decenas de consultas a la vez cuando crezca la plataforma.
 */
export async function getPlatformOverview(now: Date = new Date()): Promise<PlatformOverview> {
  const { db } = firebaseAdmin();
  // Sin orderBy("createdAt"): un local sin createdAt (seed, migración) quedaría afuera del listado.
  const snapshot = await db.collection("tenants").select(...LIST_FIELDS).get();
  const billingById = new Map(await Promise.all(snapshot.docs.map(async (doc) => [doc.id, await billingOf(doc.data())] as const)));
  const tenants = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      isDemo: data.isDemo === true,
      ref: doc.ref,
      id: doc.id,
      name: String(data.name ?? ""),
      slug: String(data.slug ?? ""),
      status: normalizeTenantStatus(data.status),
      plan: planLabel(data.plan),
      timezone: typeof data.timezone === "string" && data.timezone ? data.timezone : PLATFORM_TZ,
      createdAt: toDateOrNull(data.createdAt),
      bookingEnabled: isBookingEnabled(data.settings as { publicBookingEnabled?: unknown } | undefined),
    };
  });
  tenants.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  const usageOf = async (tenant: (typeof tenants)[number]) => {
    const [owner, mpStatus, appointments30d, lastAt] = await Promise.all([
      ownerOf(tenant.ref),
      mpStatusOf(tenant.ref),
      countCreatedSince(tenant.ref, rollingWindowStart(30, tenant.timezone, now)),
      lastAppointmentAt(tenant.ref),
    ]);
    return { owner, mpStatus, appointments30d, lastAt };
  };

  const usageTask = (async () => {
    const usage = new Map<string, Awaited<ReturnType<typeof usageOf>>>();
    for (let offset = 0; offset < tenants.length; offset += BATCH_SIZE) {
      const batch = tenants.slice(offset, offset + BATCH_SIZE);
      const results = await Promise.all(batch.map(usageOf));
      batch.forEach((tenant, index) => usage.set(tenant.id, results[index]));
    }
    return usage;
  })();

  const [usage, platformAnalytics] = await Promise.all([
    usageTask,
    getPlatformAnalytics({ tenants, days: 14, now }),
  ]);
  const analyticsById = new Map(platformAnalytics.tenants.map((entry) => [entry.tenantId, entry.analytics.totals]));
  // Los demo (demo-individual, demo-equipo...) inflaban visitas y conversión de la plataforma.
  const demoIds = new Set(tenants.filter((tenant) => tenant.isDemo).map((tenant) => tenant.id));
  const realRanges = platformAnalytics.tenants.filter((entry) => !demoIds.has(entry.tenantId)).map((entry) => entry.analytics);
  const aggregate = realRanges.length > 0
    ? mergeAnalyticsRanges(realRanges)
    : buildAnalyticsRange(platformAnalytics.aggregate.startISO, platformAnalytics.aggregate.endISO, new Map());

  const rows: PlatformTenantRow[] = tenants.map((tenant) => {
    const u = usage.get(tenant.id);
    const totals = analyticsById.get(tenant.id);
    const lastAt = u?.lastAt ?? null;
    const billing = billingById.get(tenant.id);
    const badge = billing
      ? billingBadge(billing.billing, billing.access)
      : { label: BILLING_STATUS_LABEL.free, tone: "confirmed" as const, filter: "free" as const };
    return {
      isDemo: tenant.isDemo,
      billingLabel: badge.label,
      billingTone: badge.tone,
      billingFilter: badge.filter,
      id: tenant.id,
      name: tenant.name || "(sin nombre)",
      slug: tenant.slug,
      status: tenant.status,
      plan: tenant.plan,
      ownerEmail: u?.owner.email ?? null,
      bookingEnabled: tenant.bookingEnabled,
      mpConnected: u?.mpStatus === "connected",
      appointments30d: u?.appointments30d ?? 0,
      lastActivityLabel: relativeActivityLabel(lastAt, now, tenant.timezone),
      lastActivityTone: activityTone(lastAt, now, tenant.timezone),
      createdLabel: platformDateLabel(tenant.createdAt),
      views14d: totals?.views ?? 0,
      confirmed14d: totals?.appointmentConfirmed ?? 0,
      conversion14d: totals?.viewToConfirmationRate ?? 0,
    };
  });

  return { rows, analytics: aggregate };
}

/* ------------------------------------------------------------------ */
/* Detalle de un local                                                  */
/* ------------------------------------------------------------------ */

export type PlatformTenantDetail = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  timezone: string;
  ownerEmail: string | null;
  ownerName: string | null;
  createdLabel: string;
  isDemo: boolean;
  suspension: { atLabel: string; reason: string | null; by: string | null } | null;
  subscription: PlatformSubscription;
  usage: {
    appointments7d: number;
    appointments30d: number;
    clients: number;
    activeStaff: number;
    activeServices: number;
    collected30d: number;
    payments30d: number;
    lastActivityLabel: string;
    lastActivityAtLabel: string;
    lastActivityTone: PlatformTone;
  };
  analytics: {
    views: number;
    bookingStarted: number;
    confirmed: number;
    conversion: number;
    days: { label: string; value: number }[];
  };
  config: {
    bookingEnabled: boolean;
    /** El turnero toma reservas de verdad: local prendido + switch + seña + medio de pago. */
    bookingOpen: boolean;
    bookingBlockedReason: string | null;
    /** Tiene seña + algún medio de pago listo (lo que exige el turnero, sin mirar los switches). */
    requirementsMet: boolean;
    deposit: string;
    mpStatus: MpStatus;
    mpEnabled: boolean;
    transferReady: boolean;
  };
};

export type BillingChargeRow = { id: string; amount: number | null; status: string; dateLabel: string; atMs: number };

export type PlatformSubscription = {
  /** false = el local no tiene `billing` (anterior a las suscripciones): se trata como cortesía. */
  hasBilling: boolean;
  status: BillingStatus;
  badge: BillingBadge;
  plan: PlanId;
  planName: string;
  accessLevel: BillingAccess["level"];
  accessSummary: string;
  trialEndLabel: string | null;
  periodEndLabel: string | null;
  cancelledAtLabel: string | null;
  /** null = no tiene propia: usa la gracia global de /platform/planes. */
  graceDays: number | null;
  mp: { preapprovalId: string; status: string | null; payerEmail: string | null } | null;
  charges: BillingChargeRow[];
};

/** Timestamp / Date / ISO / ms -> ms (los cobros los escribe el backend de MP; se lee defensivo). */
function toMs(value: unknown): number | null {
  const date = toDateOrNull(value);
  if (date) return date.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

const CHARGES_SCAN = 50;
const CHARGES_SHOWN = 6;

/**
 * Últimos cobros de la suscripción: `billingPayments` (raíz) con
 * where("tenantId") -- índice automático de un campo, SIN orderBy (eso
 * pediría el compuesto tenantId+fecha). Se traen hasta 50 y se ordenan acá.
 */
async function lastCharges(tenantId: string): Promise<BillingChargeRow[]> {
  try {
    const snapshot = await firebaseAdmin().db.collection("billingPayments").where("tenantId", "==", tenantId).limit(CHARGES_SCAN).get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        const atMs = toMs(data.paidAt) ?? toMs(data.dateApproved) ?? toMs(data.createdAt) ?? toMs(data.dateCreated) ?? 0;
        const rawAmount = data.amount ?? data.transactionAmount ?? data.transaction_amount;
        const amount = typeof rawAmount === "number" && Number.isFinite(rawAmount) ? rawAmount : null;
        return {
          id: doc.id,
          amount,
          status: String(data.status ?? ""),
          dateLabel: atMs ? platformDateTimeLabel(new Date(atMs)) : "—",
          atMs,
        };
      })
      .sort((a, b) => b.atMs - a.atMs)
      .slice(0, CHARGES_SHOWN);
  } catch (error) {
    console.error("[platform] billingPayments", tenantId, error);
    return [];
  }
}

async function subscriptionOf(tenantId: string, data: Record<string, unknown>): Promise<PlatformSubscription> {
  const [{ billing, access }, charges] = await Promise.all([billingOf(data), lastCharges(tenantId)]);
  const status: BillingStatus = billing?.status ?? "free";
  const plan = billingPlanOf(billing, data.plan);
  return {
    hasBilling: billing !== null,
    status,
    badge: billingBadge(billing, access),
    plan,
    planName: PLANS[plan].name,
    accessLevel: access.level,
    accessSummary: billingAccessSummary(access),
    trialEndLabel: billing?.trialEndsAt ? inclusiveEndLabel(billing.trialEndsAt) : null,
    periodEndLabel: billing?.currentPeriodEnd ? inclusiveEndLabel(billing.currentPeriodEnd) : null,
    cancelledAtLabel: billing?.cancelledAt ? platformDateTimeLabel(new Date(billing.cancelledAt)) : null,
    graceDays: billing?.graceDays != null ? Math.max(0, billing.graceDays) : null,
    mp: billing?.mpPreapprovalId
      ? { preapprovalId: billing.mpPreapprovalId, status: billing.mpPreapprovalStatus ?? null, payerEmail: billing.payerEmail ?? null }
      : null,
    charges,
  };
}

/**
 * Lecturas: local (1), dueña (2), MP (1), 5 count() (1 c/u cada 1000
 * docs), último turno (1), pagos aprobados de 30 días por el índice
 * payments(tenantId, paidAt) (1 por pago, mínimo 1) y la analítica de 14
 * días (1 por día con datos, mínimo 1). La auditoría la lee la página aparte.
 */
export async function getPlatformTenantDetail(tenantId: string, now: Date = new Date()): Promise<PlatformTenantDetail | null> {
  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const snapshot = await tenantRef.get();
  if (!snapshot.exists) return null;
  const data = snapshot.data() as Partial<TenantRecord> & Record<string, unknown>;
  const timezone = typeof data.timezone === "string" && data.timezone ? data.timezone : PLATFORM_TZ;
  const status = normalizeTenantStatus(data.status);
  const since7 = rollingWindowStart(7, timezone, now);
  const since30 = rollingWindowStart(30, timezone, now);
  const paymentsEnd = dayRange(todayISO(timezone, now), timezone).end;

  const [owner, mpStatus, appointments7d, appointments30d, clients, activeStaff, activeServices, lastAt, payments, analytics, subscription] = await Promise.all([
    ownerOf(tenantRef),
    mpStatusOf(tenantRef),
    countCreatedSince(tenantRef, since7),
    countCreatedSince(tenantRef, since30),
    tenantRef.collection("clients").count().get().then((s) => s.data().count),
    tenantRef.collection("staff").where("active", "==", true).count().get().then((s) => s.data().count),
    // Archivar un servicio también lo pasa a active:false (servicios/actions.ts).
    tenantRef.collection("services").where("active", "==", true).count().get().then((s) => s.data().count),
    lastAppointmentAt(tenantRef),
    getPayments(tenantId, { start: since30, end: paymentsEnd }),
    getTenantAnalyticsRange({ tenantId, timezone, days: 14, now }),
    subscriptionOf(tenantId, data),
  ]);
  const collected = summarizePayments(payments);

  const settings = (data.settings ?? {}) as TenantRecord["settings"];
  const mpConnected = mpStatus === "connected";
  const availability = bookingAvailability(
    { settings: { depositType: settings.depositType ?? "none", payments: settings.payments } },
    mpConnected,
  );
  const bookingEnabled = isBookingEnabled(settings);
  const bookingBlockedReason = status === "suspended"
    ? "El local está apagado"
    : !bookingEnabled
      ? "El turnero está apagado"
      : availability.reason === "no_deposit"
        ? "No tiene seña configurada"
        : availability.reason === "no_payment_method"
          ? "No tiene Mercado Pago ni transferencia lista"
          : null;

  return {
    id: tenantId,
    name: String(data.name ?? "") || "(sin nombre)",
    slug: String(data.slug ?? ""),
    status,
    plan: planLabel(data.plan),
    timezone,
    ownerEmail: owner.email,
    ownerName: owner.name,
    createdLabel: platformDateLabel(toDateOrNull(data.createdAt)),
    isDemo: data.isDemo === true,
    subscription,
    suspension: status === "suspended"
      ? {
          atLabel: platformDateTimeLabel(toDateOrNull(data.suspendedAt)),
          reason: typeof data.suspendedReason === "string" && data.suspendedReason ? data.suspendedReason : null,
          by: typeof data.suspendedBy === "string" && data.suspendedBy ? data.suspendedBy : null,
        }
      : null,
    usage: {
      appointments7d,
      appointments30d,
      clients,
      activeStaff,
      activeServices,
      collected30d: collected.gross,
      payments30d: collected.count,
      lastActivityLabel: relativeActivityLabel(lastAt, now, timezone),
      lastActivityAtLabel: platformDateTimeLabel(lastAt),
      lastActivityTone: activityTone(lastAt, now, timezone),
    },
    analytics: {
      views: analytics.totals.views,
      bookingStarted: analytics.totals.bookingStarted,
      confirmed: analytics.totals.appointmentConfirmed,
      conversion: analytics.totals.viewToConfirmationRate,
      days: analytics.days.map((day) => ({ label: day.dateISO.slice(8), value: day.views })),
    },
    config: {
      bookingEnabled,
      bookingOpen: bookingBlockedReason === null,
      bookingBlockedReason,
      requirementsMet: availability.enabled,
      deposit: depositLabel(settings),
      mpStatus,
      mpEnabled: settings.payments?.mercadopagoEnabled !== false,
      transferReady: isTransferReady(settings.payments?.transfer),
    },
  };
}
