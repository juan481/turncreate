export const ANALYTICS_EVENTS = [
  "views",
  "bookingStarted",
  "checkoutStarted",
  "paymentApproved",
  "appointmentConfirmed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const PUBLIC_ANALYTICS_EVENTS = ["views", "bookingStarted", "checkoutStarted"] as const;
export type PublicAnalyticsEvent = (typeof PUBLIC_ANALYTICS_EVENTS)[number];

export const TRUSTED_ANALYTICS_EVENTS = ["paymentApproved", "appointmentConfirmed"] as const;
export type TrustedAnalyticsEvent = (typeof TRUSTED_ANALYTICS_EVENTS)[number];

export type AnalyticsCounters = Record<AnalyticsEvent, number>;

export type DailyAnalytics = AnalyticsCounters & {
  dateISO: string;
  approximateUniqueVisitors: number;
};

export type AnalyticsTotals = AnalyticsCounters & {
  approximateUniqueVisitors: number;
  viewToBookingRate: number;
  viewToConfirmationRate: number;
  checkoutApprovalRate: number;
};

export type AnalyticsRange = {
  startISO: string;
  endISO: string;
  days: DailyAnalytics[];
  totals: AnalyticsTotals;
};

export type TenantAnalyticsSummary = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  analytics: AnalyticsRange;
};

export function isPublicAnalyticsEvent(value: unknown): value is PublicAnalyticsEvent {
  return typeof value === "string" && (PUBLIC_ANALYTICS_EVENTS as readonly string[]).includes(value);
}

export function isTrustedAnalyticsEvent(value: unknown): value is TrustedAnalyticsEvent {
  return typeof value === "string" && (TRUSTED_ANALYTICS_EVENTS as readonly string[]).includes(value);
}
