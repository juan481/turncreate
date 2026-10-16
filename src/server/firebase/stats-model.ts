import { grossUp, roundMoney } from "@/domain/money/payment";
import { toDateISOInTz } from "@/lib/dates";

/**
 * Lógica pura de los agregados de plata (sin Firestore): la usan
 * `stats.ts` (servidor) y las pantallas de Caja/Reportes, y se testea
 * sola. Un pago es lo que hay en tenants/{id}/appointments/{id}/payments.
 */

/** Medios que la UI muestra siempre (aunque estén en $0), en este orden. */
export const PAYMENT_METHODS = ["cash", "transfer", "card_posnet", "mercadopago"] as const;
export type KnownPaymentMethod = (typeof PAYMENT_METHODS)[number];
export type MethodKey = KnownPaymentMethod | "other";

export type PaymentSummary = { gross: number; applied: number; fees: number; surcharges: number; net: number; count: number };

export type NormalizedPayment = {
  id: string;
  appointmentId: string | null;
  method: MethodKey;
  kind: string;
  /** Lo que pagó la clienta (incluye el recargo si la comisión se traslada). */
  gross: number;
  /** Lo que se descontó del saldo del turno (la seña / el saldo). */
  applied: number;
  /** Comisión real que cobró Mercado Pago. */
  fee: number;
  /** Recargo que pagó la clienta para cubrir la comisión ("La paga la clienta"). */
  surcharge: number;
  /** Lo que efectivamente te quedó. */
  net: number;
  paidAt: Date | null;
  /** Cobro de Mercado Pago anterior al desglose: se sabe el monto, no la comisión real. */
  feeUnknown: boolean;
};

export type MethodTotals = { gross: number; net: number; fees: number; count: number };
export type PaymentBreakdown = PaymentSummary & {
  byMethod: Record<MethodKey, MethodTotals>;
  feeUnknownCount: number;
};

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") return (value as { toDate: () => Date }).toDate();
  return null;
}

function isKnownMethod(value: string): value is KnownPaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/**
 * Pagos v2 traen el desglose completo; los viejos (antes del modelo v2,
 * o migrados con scripts/backfill-payments-v2.cjs) solo `amount`. Mismos
 * defaults que el backfill: sin estado = aprobado, sin medio = efectivo,
 * sin desglose = bruto = neto = `amount` y comisión 0.
 */
export function normalizePayment(id: string, data: Record<string, unknown>): NormalizedPayment | null {
  if ((data.status ?? "approved") !== "approved") return null;
  const applied = money(data.appliedAmount ?? data.amount);
  const gross = data.grossAmount != null ? money(data.grossAmount) : applied;
  const fee = money(data.feeAmount);
  const surcharge = money(data.surchargeAmount);
  const net = data.netAmount != null ? money(data.netAmount) : roundMoney(gross - fee);
  const rawMethod = String(data.method ?? "cash");
  const method: MethodKey = isKnownMethod(rawMethod) ? rawMethod : "other";
  return {
    id,
    appointmentId: typeof data.appointmentId === "string" && data.appointmentId ? data.appointmentId : null,
    method,
    kind: String(data.kind ?? ""),
    gross,
    applied,
    fee,
    surcharge,
    net,
    paidAt: toDate(data.paidAt) ?? toDate(data.createdAt),
    feeUnknown: method === "mercadopago" && (data.feeAmount == null || data.source === "migration"),
  };
}

function emptyMethodTotals(): Record<MethodKey, MethodTotals> {
  const keys: MethodKey[] = [...PAYMENT_METHODS, "other"];
  return Object.fromEntries(keys.map((key) => [key, { gross: 0, net: 0, fees: 0, count: 0 }])) as Record<MethodKey, MethodTotals>;
}

export function summarizePayments(payments: Iterable<NormalizedPayment>): PaymentBreakdown {
  const result: PaymentBreakdown = { gross: 0, applied: 0, fees: 0, surcharges: 0, net: 0, count: 0, byMethod: emptyMethodTotals(), feeUnknownCount: 0 };
  for (const payment of payments) {
    result.gross += payment.gross;
    result.applied += payment.applied;
    result.fees += payment.fee;
    result.surcharges += payment.surcharge;
    result.net += payment.net;
    result.count += 1;
    if (payment.feeUnknown) result.feeUnknownCount += 1;
    const bucket = result.byMethod[payment.method];
    bucket.gross += payment.gross;
    bucket.net += payment.net;
    bucket.fees += payment.fee;
    bucket.count += 1;
  }
  result.gross = roundMoney(result.gross);
  result.applied = roundMoney(result.applied);
  result.fees = roundMoney(result.fees);
  result.surcharges = roundMoney(result.surcharges);
  result.net = roundMoney(result.net);
  for (const bucket of Object.values(result.byMethod)) {
    bucket.gross = roundMoney(bucket.gross);
    bucket.net = roundMoney(bucket.net);
    bucket.fees = roundMoney(bucket.fees);
  }
  return result;
}

export function toPaymentSummary(breakdown: PaymentBreakdown): PaymentSummary {
  const { gross, applied, fees, surcharges, net, count } = breakdown;
  return { gross, applied, fees, surcharges, net, count };
}

/** Totales por día calendario del local ("YYYY-MM-DD" en `timezone`, nunca en la zona del servidor). */
export function paymentsByDay(payments: Iterable<NormalizedPayment>, timezone: string): Map<string, MethodTotals> {
  const days = new Map<string, MethodTotals>();
  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const dateISO = toDateISOInTz(payment.paidAt, timezone);
    const bucket = days.get(dateISO) ?? { gross: 0, net: 0, fees: 0, count: 0 };
    bucket.gross = roundMoney(bucket.gross + payment.gross);
    bucket.net = roundMoney(bucket.net + payment.net);
    bucket.fees = roundMoney(bucket.fees + payment.fee);
    bucket.count += 1;
    days.set(dateISO, bucket);
  }
  return days;
}

/** Reparte pagos en rangos [start, end) por `paidAt`. Un pago puede caer en varios rangos si se solapan (día ⊂ semana ⊂ mes). */
export function splitPaymentsByRanges(payments: readonly NormalizedPayment[], ranges: readonly { start: Date; end: Date }[]): NormalizedPayment[][] {
  return ranges.map((range) => payments.filter((payment) => payment.paidAt !== null && payment.paidAt >= range.start && payment.paidAt < range.end));
}

export type CompletedSummary = {
  count: number;
  income: number;
  ticketMax: number;
  clientIds: string[];
  services: { id: string; name: string; count: number; income: number }[];
  staff: { name: string; count: number; photo: string | null }[];
};

/**
 * Turnos COMPLETADOS de un período: lo que Reportes llama "facturado" (el
 * precio de los servicios). No depende de cómo se cobró ni de comisiones.
 */
export function summarizeCompleted(appointments: Iterable<Record<string, unknown>>): CompletedSummary {
  let count = 0;
  let income = 0;
  let ticketMax = 0;
  const clientIds = new Set<string>();
  const services = new Map<string, { name: string; count: number; income: number }>();
  const staff = new Map<string, { count: number; photo: string | null }>();
  for (const entry of appointments) {
    if (entry.status !== "completed") continue;
    const total = money(entry.total);
    count += 1;
    income += total;
    ticketMax = Math.max(ticketMax, total);
    if (typeof entry.clientId === "string" && entry.clientId) clientIds.add(entry.clientId);
    for (const item of (Array.isArray(entry.items) ? entry.items : []) as { serviceId?: string; name?: string; price?: number }[]) {
      const id = item.serviceId ?? item.name ?? "";
      if (!id) continue;
      const prev = services.get(id) ?? { name: item.name ?? "Servicio", count: 0, income: 0 };
      services.set(id, { name: item.name ?? prev.name, count: prev.count + 1, income: prev.income + money(item.price) });
    }
    const staffName = String(entry.staffName ?? "");
    if (staffName) {
      const prev = staff.get(staffName);
      staff.set(staffName, { count: (prev?.count ?? 0) + 1, photo: (entry.staffPhoto as string | null | undefined) ?? prev?.photo ?? null });
    }
  }
  return {
    count,
    income: roundMoney(income),
    ticketMax,
    clientIds: [...clientIds],
    services: [...services.entries()].map(([id, data]) => ({ id, ...data, income: roundMoney(data.income) })).sort((a, b) => b.count - a.count),
    staff: [...staff.entries()].map(([name, data]) => ({ name, ...data })).sort((a, b) => b.count - a.count),
  };
}

/** Ejemplo numérico de "La absorbo yo" vs "La paga la clienta" para una seña dada. `null` si no hay % configurado. */
export function mpFeeExample(deposit: number, feePercent: number) {
  const rate = feePercent / 100;
  if (!(deposit > 0) || !(rate > 0 && rate < 1)) return null;
  const absorbedFee = roundMoney(deposit * rate);
  const passedGross = grossUp(deposit, rate);
  const passedFee = roundMoney(passedGross * rate);
  return {
    absorbed: { clientPays: deposit, fee: absorbedFee, youReceive: roundMoney(deposit - absorbedFee) },
    passedThrough: { clientPays: passedGross, fee: passedFee, youReceive: roundMoney(passedGross - passedFee) },
  };
}
