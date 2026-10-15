import "server-only";

import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { addDaysISO, isDateISO, todayISO } from "@/lib/dates";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { buildAnalyticsRange, mergeAnalyticsRanges, UNIQUE_VISITOR_BUCKETS } from "./model";
import type {
  AnalyticsEvent,
  AnalyticsRange,
  TenantAnalyticsSummary,
  TrustedAnalyticsEvent,
} from "./types";

const ANALYTICS_COLLECTION = "analyticsDaily";
const TENANT_CACHE_TTL_MS = 5 * 60_000;
const tenantCache = new Map<string, { expiresAt: number; tenant: { id: string; name: string; slug: string; timezone: string } }>();

function safeDays(days: number): number {
  if (!Number.isFinite(days)) return 14;
  return Math.max(1, Math.min(90, Math.floor(days)));
}

export async function resolveAnalyticsTenant(slug: string) {
  const now = Date.now();
  const cached = tenantCache.get(slug);
  if (cached && cached.expiresAt > now) return cached.tenant;

  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return null;
  const resolved = { id: tenant.id, name: tenant.name, slug: tenant.slug, timezone: tenant.timezone };
  tenantCache.set(slug, { expiresAt: now + TENANT_CACHE_TTL_MS, tenant: resolved });
  if (tenantCache.size > 500) tenantCache.delete(tenantCache.keys().next().value ?? slug);
  return resolved;
}

export async function recordDailyAnalyticsEvent(input: {
  tenantId: string;
  timezone: string;
  event: AnalyticsEvent;
  visitorBucket?: number;
  dateISO?: string;
  count?: number;
}) {
  const dateISO = input.dateISO ?? todayISO(input.timezone);
  if (!isDateISO(dateISO)) throw new Error("Fecha de analítica inválida");
  const count = Math.max(1, Math.min(100, Math.floor(input.count ?? 1)));
  const update: Record<string, unknown> = {
    tenantId: input.tenantId,
    date: dateISO,
    timezone: input.timezone,
    schemaVersion: 1,
    [input.event]: FieldValue.increment(count),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (Number.isInteger(input.visitorBucket) && input.visitorBucket! >= 0 && input.visitorBucket! < UNIQUE_VISITOR_BUCKETS) {
    update.visitorBuckets = FieldValue.arrayUnion(input.visitorBucket);
  }

  await firebaseAdmin().db
    .collection("tenants")
    .doc(input.tenantId)
    .collection(ANALYTICS_COLLECTION)
    .doc(dateISO)
    .set(update, { merge: true });
}

export async function recordTrustedAnalyticsEvent(input: {
  tenantId: string;
  timezone: string;
  event: TrustedAnalyticsEvent;
  dateISO?: string;
}) {
  await recordDailyAnalyticsEvent(input);
}

export async function getTenantAnalyticsRange(input: {
  tenantId: string;
  timezone: string;
  days?: number;
  now?: Date;
}): Promise<AnalyticsRange> {
  const days = safeDays(input.days ?? 14);
  const endISO = todayISO(input.timezone, input.now);
  const startISO = addDaysISO(endISO, -(days - 1));
  const snapshot = await firebaseAdmin().db
    .collection("tenants")
    .doc(input.tenantId)
    .collection(ANALYTICS_COLLECTION)
    .orderBy(FieldPath.documentId())
    .startAt(startISO)
    .endAt(endISO)
    .get();

  const storedDays = new Map(snapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]));
  return buildAnalyticsRange(startISO, endISO, storedDays);
}

export async function getPlatformAnalytics(input: {
  tenants: readonly { id: string; name: string; slug: string; timezone?: string }[];
  days?: number;
  now?: Date;
}): Promise<{ aggregate: AnalyticsRange; tenants: TenantAnalyticsSummary[] }> {
  const days = safeDays(input.days ?? 14);
  const summaries: TenantAnalyticsSummary[] = [];
  // Lotes chicos para no abrir decenas de consultas simultáneas cuando crezca
  // la plataforma. Cada tenant hace una sola query y sólo devuelve días existentes.
  for (let offset = 0; offset < input.tenants.length; offset += 10) {
    const batch = input.tenants.slice(offset, offset + 10);
    const results = await Promise.all(batch.map(async (tenant) => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      analytics: await getTenantAnalyticsRange({
        tenantId: tenant.id,
        timezone: tenant.timezone || "America/Argentina/Buenos_Aires",
        days,
        now: input.now,
      }),
    })));
    summaries.push(...results);
  }

  const endISO = todayISO("America/Argentina/Buenos_Aires", input.now);
  const emptyAggregate = buildAnalyticsRange(addDaysISO(endISO, -(days - 1)), endISO, new Map());
  return {
    aggregate: summaries.length > 0 ? mergeAnalyticsRanges(summaries.map((summary) => summary.analytics)) : emptyAggregate,
    tenants: summaries,
  };
}
