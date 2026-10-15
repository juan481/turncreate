import { describe, expect, it } from "vitest";
import { approximateUniqueVisitors, buildAnalyticsRange, UNIQUE_VISITOR_BUCKETS } from "./model";
import { dailyVisitorHash, visitorBucket } from "./privacy";
import { acceptPublicAnalyticsEvent, clearAnalyticsRateLimitForTests } from "./rate-limit";

describe("analytics privacy", () => {
  it("genera una identidad estable sólo durante el mismo día y tenant", () => {
    const base = { secret: "test-secret", tenantId: "tenant-1", identifier: "cookie-ip-agent" };
    const today = dailyVisitorHash({ ...base, dateISO: "2026-10-14" });
    expect(dailyVisitorHash({ ...base, dateISO: "2026-10-14" })).toBe(today);
    expect(dailyVisitorHash({ ...base, dateISO: "2026-10-15" })).not.toBe(today);
    expect(dailyVisitorHash({ ...base, tenantId: "tenant-2", dateISO: "2026-10-14" })).not.toBe(today);
    expect(today).not.toContain(base.identifier);
  });

  it("reduce el hash a un bucket anónimo acotado", () => {
    const hash = dailyVisitorHash({ secret: "test-secret", tenantId: "tenant-1", dateISO: "2026-10-14", identifier: "visitor" });
    expect(visitorBucket(hash)).toBeGreaterThanOrEqual(0);
    expect(visitorBucket(hash)).toBeLessThan(UNIQUE_VISITOR_BUCKETS);
  });

  it("corrige colisiones al estimar visitantes únicos", () => {
    expect(approximateUniqueVisitors(0)).toBe(0);
    expect(approximateUniqueVisitors(100)).toBeGreaterThanOrEqual(100);
  });
});

describe("analytics rate limit", () => {
  it("descarta repeticiones rápidas sin escribir estado externo", () => {
    clearAnalyticsRateLimitForTests();
    const event = { tenantId: "tenant-1", event: "views" as const, rateIdentity: "daily-rate-id" };
    expect(acceptPublicAnalyticsEvent({ ...event, now: 1_000 })).toBe(true);
    expect(acceptPublicAnalyticsEvent({ ...event, now: 2_000 })).toBe(false);
    expect(acceptPublicAnalyticsEvent({ ...event, now: 31_001 })).toBe(true);
  });
});

describe("analytics range", () => {
  it("completa días vacíos y calcula conversiones", () => {
    const stored = new Map<string, Record<string, unknown>>([
      ["2026-10-13", { views: 10, bookingStarted: 4, checkoutStarted: 2, paymentApproved: 1, appointmentConfirmed: 1, visitorBuckets: [1, 2, 2] }],
    ]);
    const range = buildAnalyticsRange("2026-10-12", "2026-10-14", stored);
    expect(range.days).toHaveLength(3);
    expect(range.days[0].views).toBe(0);
    expect(range.totals.views).toBe(10);
    expect(range.totals.approximateUniqueVisitors).toBe(2);
    expect(range.totals.viewToBookingRate).toBe(40);
    expect(range.totals.checkoutApprovalRate).toBe(50);
  });
});
