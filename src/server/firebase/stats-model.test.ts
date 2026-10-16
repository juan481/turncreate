import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dayRange, monthRange, weekRange } from "@/lib/dates";
import {
  awaitsDeposit,
  dailyPaymentHistory,
  inRange,
  isRefundDue,
  normalizePayment,
  paymentsByDay,
  porCobrarOf,
  splitPaymentsByRanges,
  summarizeAppointments,
  summarizeCompleted,
  summarizePayments,
  toPaymentSummary,
  type NormalizedPayment,
} from "./stats-model";

const AR = "America/Argentina/Buenos_Aires";

/** Pago normalizado de prueba (lo que devolvería Firestore pasado por normalizePayment). */
function payment(id: string, data: Record<string, unknown>): NormalizedPayment {
  const normalized = normalizePayment(id, { status: "approved", method: "cash", ...data });
  if (!normalized) throw new Error(`el pago ${id} no debería descartarse`);
  return normalized;
}

// Argentina es UTC-3 todo el año: 00:00 ART = 03:00Z.
for (const processTz of ["UTC", "Asia/Tokyo", AR]) {
  describe(`rangos en la zona del local (TZ del proceso = ${processTz})`, () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = processTz;
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it("un pago a las 23:30 hora AR cuenta en ESE día, no en el siguiente (aunque en UTC ya sea mañana)", () => {
      const late = payment("late", { grossAmount: 1000, paidAt: new Date("2026-10-16T02:30:00Z") }); // 15/10 23:30 ART
      const oct15 = dayRange("2026-10-15", AR);
      const oct16 = dayRange("2026-10-16", AR);
      expect(inRange(late.paidAt, oct15)).toBe(true);
      expect(inRange(late.paidAt, oct16)).toBe(false);
      expect([...paymentsByDay([late], AR).keys()]).toEqual(["2026-10-15"]);
    });

    it("el rango es [inicio, fin): medianoche AR entra al día nuevo y no al anterior", () => {
      const midnight = new Date("2026-10-16T03:00:00Z"); // 16/10 00:00 ART
      expect(inRange(midnight, dayRange("2026-10-16", AR))).toBe(true);
      expect(inRange(midnight, dayRange("2026-10-15", AR))).toBe(false);
      expect(inRange(new Date("2026-10-16T02:59:59.999Z"), dayRange("2026-10-15", AR))).toBe(true);
      expect(inRange(null, dayRange("2026-10-15", AR))).toBe(false);
    });

    it("mes: el 1° a las 00:00 AR es del mes nuevo; el 31 a las 23:59 AR es del anterior", () => {
      const october = monthRange("2026-10-01", AR);
      expect(inRange(new Date("2026-10-01T03:00:00Z"), october)).toBe(true);
      expect(inRange(new Date("2026-10-01T02:59:00Z"), october)).toBe(false); // 30/9 23:59 ART
      expect(inRange(new Date("2026-11-01T02:59:00Z"), october)).toBe(true); // 31/10 23:59 ART
      expect(inRange(new Date("2026-11-01T03:00:00Z"), october)).toBe(false);
    });

    it("splitPaymentsByRanges reparte por día ⊂ semana ⊂ mes con los mismos bordes", () => {
      const payments = [
        payment("a", { grossAmount: 100, paidAt: new Date("2026-10-16T02:30:00Z") }), // jue 15/10 23:30 ART
        payment("b", { grossAmount: 200, paidAt: new Date("2026-10-16T13:00:00Z") }), // vie 16/10
        payment("c", { grossAmount: 300, paidAt: new Date("2026-10-12T02:00:00Z") }), // dom 11/10 23:00 ART (semana anterior)
      ];
      const [day, week, month] = splitPaymentsByRanges(payments, [
        dayRange("2026-10-16", AR),
        weekRange("2026-10-16", AR),
        monthRange("2026-10-01", AR),
      ]);
      expect(day.map((p) => p.id)).toEqual(["b"]);
      expect(week.map((p) => p.id)).toEqual(["a", "b"]);
      expect(month.map((p) => p.id)).toEqual(["a", "b", "c"]);
    });

    it("dailyPaymentHistory agrupa por día del local, del más nuevo al más viejo", () => {
      const history = dailyPaymentHistory(
        [
          payment("a", { grossAmount: 100, paidAt: new Date("2026-10-16T02:30:00Z") }), // 15/10
          payment("b", { grossAmount: 200, method: "transfer", paidAt: new Date("2026-10-16T13:00:00Z") }), // 16/10
          payment("c", { grossAmount: 50, paidAt: new Date("2026-10-15T15:00:00Z") }), // 15/10
        ],
        AR,
      );
      expect(history.map((day) => day.dateISO)).toEqual(["2026-10-16", "2026-10-15"]);
      expect(history[0].breakdown.gross).toBe(200);
      expect(history[0].breakdown.byMethod.transfer.gross).toBe(200);
      expect(history[1].breakdown.gross).toBe(150);
      expect(history[1].breakdown.count).toBe(2);
    });
  });
}

describe("Cobrado: bruto de pagos aprobados", () => {
  it("usa grossAmount (con recargo y productos), no appliedAmount", () => {
    const breakdown = summarizePayments([
      payment("mp", { method: "mercadopago", grossAmount: 1060, appliedAmount: 1000, surchargeAmount: 60, feeAmount: 60, netAmount: 1000, paidAt: new Date() }),
      payment("caja", { grossAmount: 2500, appliedAmount: 2000, netAmount: 2500, paidAt: new Date() }), // $500 de producto
    ]);
    expect(breakdown.gross).toBe(3560);
    expect(breakdown.applied).toBe(3000);
    expect(breakdown.surcharges).toBe(60);
    expect(breakdown.fees).toBe(60);
    expect(breakdown.net).toBe(3500);
    expect(breakdown.byMethod.mercadopago.gross).toBe(1060);
    expect(breakdown.byMethod.cash.gross).toBe(2500);
    expect(toPaymentSummary(breakdown)).toEqual({ gross: 3560, applied: 3000, fees: 60, surcharges: 60, net: 3500, count: 2 });
  });

  it("los pagos refunded (u otro estado no aprobado) no cuentan", () => {
    expect(normalizePayment("r", { status: "refunded", grossAmount: 1000 })).toBeNull();
    expect(normalizePayment("p", { status: "pending", grossAmount: 1000 })).toBeNull();
    expect(normalizePayment("x", { status: "rejected", grossAmount: 1000 })).toBeNull();
    const kept = [
      normalizePayment("ok", { status: "approved", grossAmount: 700 }),
      normalizePayment("r", { status: "refunded", grossAmount: 1000 }),
    ].filter((p): p is NormalizedPayment => p !== null);
    expect(summarizePayments(kept).gross).toBe(700);
  });

  it("pagos viejos sin estado ni desglose cuentan como aprobados en efectivo por `amount`", () => {
    const legacy = normalizePayment("old", { amount: 800, createdAt: new Date("2025-01-10T15:00:00Z") });
    expect(legacy).not.toBeNull();
    expect(legacy!.gross).toBe(800);
    expect(legacy!.net).toBe(800);
    expect(legacy!.method).toBe("cash");
    expect(legacy!.paidAt?.toISOString()).toBe("2025-01-10T15:00:00.000Z");
  });

  it("redondea a centavos aunque la suma en coma flotante no cierre", () => {
    const breakdown = summarizePayments([payment("a", { grossAmount: 0.1 }), payment("b", { grossAmount: 0.2 })]);
    expect(breakdown.gross).toBe(0.3);
  });
});

describe("A devolver (señas refund_required)", () => {
  it("isRefundDue: cancelado + 'Devolver' + todavía no devuelto", () => {
    expect(isRefundDue({ status: "cancelled", depositDisposition: "refund_required" })).toBe(true);
    expect(isRefundDue({ status: "cancelled", depositDisposition: "refund_required", depositRefunded: true })).toBe(false);
    expect(isRefundDue({ status: "cancelled", depositDisposition: "retained" })).toBe(false);
    expect(isRefundDue({ status: "cancelled", depositDisposition: "credit" })).toBe(false);
    expect(isRefundDue({ status: "confirmed", depositDisposition: "refund_required" })).toBe(false);
  });

  it("sus pagos salen de cobrado/neto/medios y van a refundDue", () => {
    const breakdown = summarizePayments(
      [
        payment("ok", { appointmentId: "t1", grossAmount: 5000, netAmount: 5000 }),
        payment("devolver", { appointmentId: "t2", method: "mercadopago", grossAmount: 1060, appliedAmount: 1000, feeAmount: 60, surchargeAmount: 60, netAmount: 1000 }),
      ],
      new Set(["t2"]),
    );
    expect(breakdown.gross).toBe(5000);
    expect(breakdown.net).toBe(5000);
    expect(breakdown.fees).toBe(0);
    expect(breakdown.count).toBe(1);
    expect(breakdown.byMethod.mercadopago.count).toBe(0);
    expect(breakdown.refundDue).toEqual({ gross: 1060, net: 1000, count: 1 });
  });

  it("sin turnos a devolver, refundDue queda en cero", () => {
    expect(summarizePayments([payment("a", { appointmentId: "t1", grossAmount: 10 })]).refundDue).toEqual({ gross: 0, net: 0, count: 0 });
  });

  it("dailyPaymentHistory también separa lo que hay que devolver", () => {
    const [day] = dailyPaymentHistory(
      [payment("x", { appointmentId: "t9", grossAmount: 300, paidAt: new Date("2026-10-16T13:00:00Z") })],
      AR,
      new Set(["t9"]),
    );
    expect(day.breakdown.gross).toBe(0);
    expect(day.breakdown.refundDue.gross).toBe(300);
  });
});

describe("Por cobrar: saldo de turnos firmes", () => {
  it("solo confirmed/completed con saldo positivo", () => {
    expect(porCobrarOf({ status: "confirmed", balance: 3000 })).toBe(3000);
    expect(porCobrarOf({ status: "completed", balance: 1500 })).toBe(1500);
    expect(porCobrarOf({ status: "confirmed", balance: 0 })).toBe(0);
    expect(porCobrarOf({ status: "confirmed", balance: -10 })).toBe(0);
  });

  it("excluye cancelados, ausentes, vencidos y los que esperan la seña", () => {
    for (const status of ["cancelled", "no_show", "expired", "pending_payment"]) {
      expect(porCobrarOf({ status, balance: 5000 })).toBe(0);
    }
    expect(awaitsDeposit({ status: "pending_payment" })).toBe(true);
    expect(awaitsDeposit({ status: "confirmed" })).toBe(false);
  });

  it("summarizeAppointments usa el mismo filtro para turnos, facturado y por cobrar", () => {
    const totals = summarizeAppointments([
      { status: "confirmed", total: 10000, balance: 7000 },
      { status: "completed", total: 8000, balance: 0 },
      { status: "completed", total: 6000, balance: 1000 },
      { status: "pending_payment", total: 9000, balance: 9000 },
      { status: "cancelled", total: 4000, balance: 4000 },
      { status: "no_show", total: 4000, balance: 4000 },
      { status: "expired", total: 4000, balance: 4000 },
    ]);
    expect(totals).toEqual({ turnos: 3, facturado: 24000, porCobrar: 8000 });
  });
});

describe("summarizeCompleted (Reportes)", () => {
  it("cuenta solo completados y no suma clientes sin id", () => {
    const summary = summarizeCompleted([
      { status: "completed", total: 5000, clientId: "c1", staffName: "Ana", items: [{ serviceId: "s1", name: "Corte", price: 5000 }] },
      { status: "completed", total: 9000, clientId: "c2", staffName: "Ana", items: [{ serviceId: "s2", name: "Color", price: 9000 }] },
      { status: "completed", total: 5000, staffName: "Bea", items: [{ serviceId: "s1", name: "Corte", price: 5000 }] },
      { status: "confirmed", total: 7000, clientId: "c3", staffName: "Bea", items: [{ serviceId: "s3", name: "Brushing", price: 7000 }] },
    ]);
    expect(summary.count).toBe(3);
    expect(summary.income).toBe(19000);
    expect(summary.ticketMax).toBe(9000);
    expect(summary.clientIds.sort()).toEqual(["c1", "c2"]);
    expect(summary.services[0]).toEqual({ id: "s1", name: "Corte", count: 2, income: 10000 });
    expect(summary.staff[0]).toMatchObject({ name: "Ana", count: 2 });
  });
});
