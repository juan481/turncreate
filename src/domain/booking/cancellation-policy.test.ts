import { describe, expect, it } from "vitest";
import {
  cancellationDepositDisposition,
  cancellationRefundDeadline,
  isCancellationRefundable,
  normalizeCancellationRefundHours,
} from "./cancellation-policy";

const startsAt = new Date("2026-10-20T15:00:00.000Z");

describe("cancellation policy", () => {
  it("normaliza la configuración dentro de límites seguros", () => {
    expect(normalizeCancellationRefundHours(undefined)).toBe(24);
    expect(normalizeCancellationRefundHours(-2)).toBe(0);
    expect(normalizeCancellationRefundHours(24.4)).toBe(24);
    expect(normalizeCancellationRefundHours(9999)).toBe(720);
  });

  it("incluye exactamente el instante límite", () => {
    expect(cancellationRefundDeadline(startsAt, 24).toISOString()).toBe("2026-10-19T15:00:00.000Z");
    expect(isCancellationRefundable(startsAt, 24, new Date("2026-10-19T15:00:00.000Z"))).toBe(true);
    expect(isCancellationRefundable(startsAt, 24, new Date("2026-10-19T15:00:00.001Z"))).toBe(false);
  });

  it("solo pide devolución si había seña y se canceló dentro del plazo", () => {
    expect(cancellationDepositDisposition({ depositPaid: 0, startsAt, hoursBefore: 24 })).toBeNull();
    expect(cancellationDepositDisposition({ depositPaid: 1000, startsAt, hoursBefore: 24, now: new Date("2026-10-19T14:00:00Z") })).toBe("refund_required");
    expect(cancellationDepositDisposition({ depositPaid: 1000, startsAt, hoursBefore: 24, now: new Date("2026-10-19T16:00:00Z") })).toBe("retained");
  });
});
