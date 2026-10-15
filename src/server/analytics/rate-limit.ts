import type { PublicAnalyticsEvent } from "./types";

const WINDOW_MS: Record<PublicAnalyticsEvent, number> = {
  views: 30_000,
  bookingStarted: 30_000,
  checkoutStarted: 60_000,
};

const MAX_ENTRIES = 20_000;
const seen = new Map<string, number>();
let callsSinceSweep = 0;

function sweep(now: number) {
  callsSinceSweep = 0;
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now) seen.delete(key);
  }
  if (seen.size <= MAX_ENTRIES) return;
  const overflow = seen.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of seen.keys()) {
    seen.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

/**
 * Limitador best-effort por proceso. Evita dobles taps y recargas rápidas sin
 * gastar una lectura/escritura adicional en Firestore. No reemplaza un WAF,
 * pero mantiene el endpoint barato frente al uso normal y bots básicos.
 */
export function acceptPublicAnalyticsEvent(input: {
  tenantId: string;
  event: PublicAnalyticsEvent;
  rateIdentity: string;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  const key = `${input.tenantId}:${input.event}:${input.rateIdentity}`;
  const expiresAt = seen.get(key);
  if (expiresAt && expiresAt > now) return false;

  seen.set(key, now + WINDOW_MS[input.event]);
  callsSinceSweep += 1;
  if (callsSinceSweep >= 250 || seen.size > MAX_ENTRIES) sweep(now);
  return true;
}

export function clearAnalyticsRateLimitForTests() {
  seen.clear();
  callsSinceSweep = 0;
}
