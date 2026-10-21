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
export const PAYMENT_KINDS = ["deposit", "full", "balance", "adjustment", "refund"] as const;
export type PaymentKindKey = (typeof PAYMENT_KINDS)[number] | "other";
export type RefundDueTotals = { gross: number; net: number; count: number };
export type PaymentBreakdown = PaymentSummary & {
  byMethod: Record<MethodKey, MethodTotals>;
  byKind: Record<PaymentKindKey, MethodTotals>;
  feeUnknownCount: number;
  /**
   * "A devolver": pagos aprobados de turnos cancelados con la seña marcada
   * para devolver (`depositDisposition: "refund_required"`) que todavía no
   * se devolvieron. NO suman en gross/applied/net/byMethod: esa plata no es
   * tuya, la tenés que devolver. Se muestran aparte.
   */
  refundDue: RefundDueTotals;
};

/* ------------------------------------------------------------------ */
/* Definiciones únicas de "Cobrado" y "Por cobrar"                      */
/* ------------------------------------------------------------------ */

/**
 * COBRADO (de un rango) = suma de `grossAmount` (lo que pagó la clienta,
 * con recargo y productos incluidos) de los pagos `approved` cuyo `paidAt`
 * cae en el rango [start, end) armado en la zona del local. Los pagos
 * `refunded` (u otro estado) no cuentan, y los "a devolver" (ver
 * `refundDue`) van aparte. Es `PaymentBreakdown.gross` -- Home, Caja y
 * Reportes leen ese mismo campo.
 *
 * POR COBRAR (de un rango) = suma de `balance > 0` de los turnos con
 * `startsAt` en el rango cuyo estado es `confirmed` o `completed`. Quedan
 * afuera `cancelled`, `no_show` y `expired` (no se van a cobrar) y
 * `pending_payment` (el turno todavía espera la seña -- MP o transferencia --
 * y si no llega se cae solo: no es plata que "te deben" todavía).
 */
export const POR_COBRAR_STATUSES: ReadonlySet<string> = new Set(["confirmed", "completed"]);

/** Turnos que todavía esperan la seña para quedar firmes. */
export function awaitsDeposit(appointment: { status?: unknown }): boolean {
  return appointment.status === "pending_payment";
}

/** Saldo que suma a "Por cobrar" (0 si el turno no entra en la definición). */
export function porCobrarOf(appointment: { status?: unknown; balance?: unknown }): number {
  if (!POR_COBRAR_STATUSES.has(String(appointment.status ?? ""))) return 0;
  const balance = money(appointment.balance);
  return balance > 0 ? balance : 0;
}

export type AppointmentTotals = { turnos: number; facturado: number; porCobrar: number };

/**
 * Turnos firmes (confirmed/completed) de un rango: cuántos son, cuánto
 * suman sus `total` y cuánto queda por cobrar. Mismo filtro para los tres.
 */
export function summarizeAppointments(appointments: Iterable<{ status?: unknown; total?: unknown; balance?: unknown }>): AppointmentTotals {
  let turnos = 0;
  let facturado = 0;
  let porCobrar = 0;
  for (const appointment of appointments) {
    if (!POR_COBRAR_STATUSES.has(String(appointment.status ?? ""))) continue;
    turnos += 1;
    facturado += money(appointment.total);
    porCobrar += porCobrarOf(appointment);
  }
  return { turnos, facturado: roundMoney(facturado), porCobrar: roundMoney(porCobrar) };
}

/**
 * ¿El turno tiene plata cobrada que hay que devolver? Cancelado + seña
 * marcada "Devolver" + todavía no devuelta (`depositRefunded` lo pone el
 * webhook de MP cuando el reintegro se concreta; en ese caso el pago ya
 * figura `refunded` y ni siquiera llega acá).
 */
export function isRefundDue(appointment: { status?: unknown; depositDisposition?: unknown; depositRefunded?: unknown }): boolean {
  return appointment.status === "cancelled" && appointment.depositDisposition === "refund_required" && appointment.depositRefunded !== true;
}

/** ¿El instante cae en [start, end)? Los rangos salen de dayRange/weekRange/monthRange (zona del local). */
export function inRange(instant: Date | null, range: { start: Date; end: Date }): boolean {
  return instant !== null && instant >= range.start && instant < range.end;
}

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
    feeUnknown: method === "mercadopago" && (data.feeUnknown === true || data.feeAmount == null || data.source === "migration"),
  };
}

function emptyMethodTotals(): Record<MethodKey, MethodTotals> {
  const keys: MethodKey[] = [...PAYMENT_METHODS, "other"];
  return Object.fromEntries(keys.map((key) => [key, { gross: 0, net: 0, fees: 0, count: 0 }])) as Record<MethodKey, MethodTotals>;
}

function emptyKindTotals(): Record<PaymentKindKey, MethodTotals> {
  const keys: PaymentKindKey[] = [...PAYMENT_KINDS, "other"];
  return Object.fromEntries(keys.map((key) => [key, { gross: 0, net: 0, fees: 0, count: 0 }])) as Record<PaymentKindKey, MethodTotals>;
}

function kindKey(value: string): PaymentKindKey {
  return (PAYMENT_KINDS as readonly string[]).includes(value) ? value as PaymentKindKey : "other";
}

/**
 * `refundDueAppointmentIds`: turnos para los que `isRefundDue` da true. Sus
 * pagos van a `refundDue` y no suman en el resto de los totales.
 */
export function summarizePayments(payments: Iterable<NormalizedPayment>, refundDueAppointmentIds: ReadonlySet<string> = new Set()): PaymentBreakdown {
  const result: PaymentBreakdown = {
    gross: 0, applied: 0, fees: 0, surcharges: 0, net: 0, count: 0,
    byMethod: emptyMethodTotals(), byKind: emptyKindTotals(), feeUnknownCount: 0, refundDue: { gross: 0, net: 0, count: 0 },
  };
  for (const payment of payments) {
    if (payment.appointmentId && refundDueAppointmentIds.has(payment.appointmentId)) {
      result.refundDue.gross += payment.gross;
      result.refundDue.net += payment.net;
      result.refundDue.count += 1;
      continue;
    }
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
    const kindBucket = result.byKind[kindKey(payment.kind)];
    kindBucket.gross += payment.gross;
    kindBucket.net += payment.net;
    kindBucket.fees += payment.fee;
    kindBucket.count += 1;
  }
  result.gross = roundMoney(result.gross);
  result.applied = roundMoney(result.applied);
  result.fees = roundMoney(result.fees);
  result.surcharges = roundMoney(result.surcharges);
  result.net = roundMoney(result.net);
  result.refundDue.gross = roundMoney(result.refundDue.gross);
  result.refundDue.net = roundMoney(result.refundDue.net);
  for (const bucket of Object.values(result.byMethod)) {
    bucket.gross = roundMoney(bucket.gross);
    bucket.net = roundMoney(bucket.net);
    bucket.fees = roundMoney(bucket.fees);
  }
  for (const bucket of Object.values(result.byKind)) {
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
  return ranges.map((range) => payments.filter((payment) => inRange(payment.paidAt, range)));
}

export type DayPayments = { dateISO: string; breakdown: PaymentBreakdown };

/**
 * Historial día por día (del más nuevo al más viejo) con el mismo desglose
 * que el resto de la app: cada día es un `summarizePayments` de los pagos
 * cuyo `paidAt` cae ese día calendario EN LA ZONA DEL LOCAL. Solo devuelve
 * días con algún movimiento (cobro o "a devolver").
 */
export function dailyPaymentHistory(
  payments: Iterable<NormalizedPayment>,
  timezone: string,
  refundDueAppointmentIds: ReadonlySet<string> = new Set(),
): DayPayments[] {
  const byDay = new Map<string, NormalizedPayment[]>();
  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const dateISO = toDateISOInTz(payment.paidAt, timezone);
    const list = byDay.get(dateISO) ?? [];
    list.push(payment);
    byDay.set(dateISO, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dateISO, list]) => ({ dateISO, breakdown: summarizePayments(list, refundDueAppointmentIds) }));
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
