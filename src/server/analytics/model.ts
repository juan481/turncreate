import { addDaysISO } from "@/lib/dates";
import { ANALYTICS_EVENTS, type AnalyticsCounters, type AnalyticsRange, type DailyAnalytics } from "./types";

export const UNIQUE_VISITOR_BUCKETS = 4096;

function safeCount(value: unknown): number {
  const count = Number(value ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function emptyCounters(): AnalyticsCounters {
  return {
    views: 0,
    bookingStarted: 0,
    checkoutStarted: 0,
    paymentApproved: 0,
    appointmentConfirmed: 0,
  };
}

export function approximateUniqueVisitors(bucketCount: number, bucketTotal = UNIQUE_VISITOR_BUCKETS): number {
  const occupied = Math.max(0, Math.min(Math.floor(bucketCount), bucketTotal));
  if (occupied === 0) return 0;
  if (occupied === bucketTotal) return bucketTotal;
  return Math.round(-bucketTotal * Math.log(1 - occupied / bucketTotal));
}

export function normalizeDailyAnalytics(dateISO: string, data?: Record<string, unknown>): DailyAnalytics {
  const bucketValues = Array.isArray(data?.visitorBuckets)
    ? data.visitorBuckets.filter((value): value is number => Number.isInteger(value) && value >= 0 && value < UNIQUE_VISITOR_BUCKETS)
    : [];
  const distinctBuckets = new Set(bucketValues).size;

  return {
    dateISO,
    views: safeCount(data?.views),
    bookingStarted: safeCount(data?.bookingStarted),
    checkoutStarted: safeCount(data?.checkoutStarted),
    paymentApproved: safeCount(data?.paymentApproved),
    appointmentConfirmed: safeCount(data?.appointmentConfirmed),
    approximateUniqueVisitors: approximateUniqueVisitors(distinctBuckets),
  };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildAnalyticsRange(
  startISO: string,
  endISO: string,
  storedDays: ReadonlyMap<string, Record<string, unknown>>,
): AnalyticsRange {
  const days: DailyAnalytics[] = [];
  for (let dateISO = startISO; dateISO <= endISO; dateISO = addDaysISO(dateISO, 1)) {
    days.push(normalizeDailyAnalytics(dateISO, storedDays.get(dateISO)));
  }

  const counters = emptyCounters();
  let approximateUniqueVisitorsTotal = 0;
  for (const day of days) {
    for (const event of ANALYTICS_EVENTS) counters[event] += day[event];
    // La identidad rota diariamente por privacidad, por eso el total del rango
    // representa visitantes-día aproximados y se suma, no se deduplica entre días.
    approximateUniqueVisitorsTotal += day.approximateUniqueVisitors;
  }

  return {
    startISO,
    endISO,
    days,
    totals: {
      ...counters,
      approximateUniqueVisitors: approximateUniqueVisitorsTotal,
      viewToBookingRate: percentage(counters.bookingStarted, counters.views),
      viewToConfirmationRate: percentage(counters.appointmentConfirmed, counters.views),
      checkoutApprovalRate: percentage(counters.paymentApproved, counters.checkoutStarted),
    },
  };
}

export function mergeAnalyticsRanges(ranges: readonly AnalyticsRange[]): AnalyticsRange {
  if (ranges.length === 0) {
    return buildAnalyticsRange("1970-01-01", "1970-01-01", new Map());
  }

  const byDate = new Map<string, Record<string, unknown>>();
  for (const range of ranges) {
    for (const day of range.days) {
      const current = byDate.get(day.dateISO) ?? {};
      byDate.set(day.dateISO, {
        views: safeCount(current.views) + day.views,
        bookingStarted: safeCount(current.bookingStarted) + day.bookingStarted,
        checkoutStarted: safeCount(current.checkoutStarted) + day.checkoutStarted,
        paymentApproved: safeCount(current.paymentApproved) + day.paymentApproved,
        appointmentConfirmed: safeCount(current.appointmentConfirmed) + day.appointmentConfirmed,
        // Al agregar tenants, la suma de estimaciones diarias es la mejor
        // aproximación disponible sin persistir identificadores entre negocios.
        approximateUniqueVisitors: safeCount(current.approximateUniqueVisitors) + day.approximateUniqueVisitors,
      });
    }
  }

  const startISO = ranges.reduce((min, range) => (range.startISO < min ? range.startISO : min), ranges[0].startISO);
  const endISO = ranges.reduce((max, range) => (range.endISO > max ? range.endISO : max), ranges[0].endISO);
  const days: DailyAnalytics[] = [];
  for (let dateISO = startISO; dateISO <= endISO; dateISO = addDaysISO(dateISO, 1)) {
    const data = byDate.get(dateISO) ?? {};
    days.push({
      dateISO,
      views: safeCount(data.views),
      bookingStarted: safeCount(data.bookingStarted),
      checkoutStarted: safeCount(data.checkoutStarted),
      paymentApproved: safeCount(data.paymentApproved),
      appointmentConfirmed: safeCount(data.appointmentConfirmed),
      approximateUniqueVisitors: safeCount(data.approximateUniqueVisitors),
    });
  }

  const counters = emptyCounters();
  let uniques = 0;
  for (const day of days) {
    for (const event of ANALYTICS_EVENTS) counters[event] += day[event];
    uniques += day.approximateUniqueVisitors;
  }
  return {
    startISO,
    endISO,
    days,
    totals: {
      ...counters,
      approximateUniqueVisitors: uniques,
      viewToBookingRate: percentage(counters.bookingStarted, counters.views),
      viewToConfirmationRate: percentage(counters.appointmentConfirmed, counters.views),
      checkoutApprovalRate: percentage(counters.paymentApproved, counters.checkoutStarted),
    },
  };
}
