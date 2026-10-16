import { describe, expect, it } from "vitest";
import { billingAccess, billingAllowsPublicBooking, billingAllowsWrites, type TenantBilling } from "./billing";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 16, 15, 0, 0);
const base = (patch: Partial<TenantBilling>): TenantBilling => ({ status: "free", plan: "solo", ...patch });

describe("billingAccess", () => {
  it("sin billing (locales viejos) = free, acceso pleno", () => {
    expect(billingAccess(undefined, NOW)).toEqual({ level: "full", reason: "free", until: null });
  });

  it("free nunca vence", () => {
    expect(billingAccess(base({ status: "free" }), NOW).level).toBe("full");
  });

  it("trial vigente, en gracia y vencido", () => {
    expect(billingAccess(base({ status: "trial", trialEndsAt: NOW + DAY }), NOW)).toEqual({ level: "full", reason: "trial", until: NOW + DAY });
    expect(billingAccess(base({ status: "trial", trialEndsAt: NOW - DAY }), NOW)).toEqual({ level: "grace", reason: "trial_ended", until: NOW + 2 * DAY });
    expect(billingAccess(base({ status: "trial", trialEndsAt: NOW - 3 * DAY }), NOW).level).toBe("readonly");
  });

  it("active al día y período vencido con gracia de 3 días", () => {
    expect(billingAccess(base({ status: "active", currentPeriodEnd: NOW + 10 * DAY }), NOW).level).toBe("full");
    expect(billingAccess(base({ status: "active", currentPeriodEnd: NOW - 2 * DAY }), NOW).level).toBe("grace");
    expect(billingAccess(base({ status: "active", currentPeriodEnd: NOW - 4 * DAY }), NOW).level).toBe("readonly");
  });

  it("past_due nunca da acceso pleno aunque el período no haya terminado", () => {
    const access = billingAccess(base({ status: "past_due", currentPeriodEnd: NOW + 5 * DAY }), NOW);
    expect(access.level).toBe("grace");
    expect(access.until).toBe(NOW + 8 * DAY);
    expect(billingAccess(base({ status: "past_due", currentPeriodEnd: NOW - 5 * DAY }), NOW).level).toBe("readonly");
  });

  it("graceDays configurable (0 = corte inmediato)", () => {
    expect(billingAccess(base({ status: "active", currentPeriodEnd: NOW - 1, graceDays: 0 }), NOW).level).toBe("readonly");
  });

  it("unpaid y cancelled: solo lectura y turnero cerrado", () => {
    for (const status of ["unpaid", "cancelled"] as const) {
      expect(billingAccess(base({ status }), NOW).level).toBe("readonly");
      expect(billingAllowsPublicBooking(base({ status }), NOW)).toBe(false);
      expect(billingAllowsWrites(base({ status }), NOW)).toBe(false);
    }
  });
});
