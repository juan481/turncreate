export const DEFAULT_CANCELLATION_REFUND_HOURS = 24;
export const MAX_CANCELLATION_REFUND_HOURS = 720;

export type DepositDisposition = "refund_required" | "retained" | null;

export function normalizeCancellationRefundHours(value: unknown): number {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return DEFAULT_CANCELLATION_REFUND_HOURS;
  return Math.min(MAX_CANCELLATION_REFUND_HOURS, Math.max(0, Math.round(hours)));
}

export function cancellationRefundDeadline(startsAt: Date, hoursBefore: number): Date {
  return new Date(startsAt.getTime() - normalizeCancellationRefundHours(hoursBefore) * 60 * 60 * 1000);
}

export function isCancellationRefundable(startsAt: Date, hoursBefore: number, now = new Date()): boolean {
  return now.getTime() <= cancellationRefundDeadline(startsAt, hoursBefore).getTime();
}

export function cancellationDepositDisposition(input: {
  depositPaid: number;
  startsAt: Date;
  hoursBefore: number;
  now?: Date;
}): DepositDisposition {
  if (!Number.isFinite(input.depositPaid) || input.depositPaid <= 0) return null;
  return isCancellationRefundable(input.startsAt, input.hoursBefore, input.now) ? "refund_required" : "retained";
}
