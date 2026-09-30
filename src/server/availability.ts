import { TZDate } from "@date-fns/tz";

/** "HH:MM:SS" (o "HH:MM") -> minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minuto del día (en `timezone`) -> instante real, para la fecha dada. */
export function minutesToInstant(dateISO: string, minutes: number, timezone: string): Date {
  const zoned = new TZDate(`${dateISO}T00:00:00`, timezone);
  zoned.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return zoned;
}

/** Instante real -> minuto del día en `timezone` (asume que no cruza medianoche local). */
export function instantToMinutes(instant: string, timezone: string): number {
  const zoned = new TZDate(new Date(instant), timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export function dayBoundsUTC(dateISO: string, timezone: string) {
  const start = new TZDate(`${dateISO}T00:00:00`, timezone);
  const end = new TZDate(`${dateISO}T23:59:59.999`, timezone);
  return { startUTC: start.toISOString(), endUTC: end.toISOString() };
}
