import { dayRange, minutesOfDayInTz, zonedInstant } from "@/lib/dates";

/** "HH:MM:SS" (o "HH:MM") -> minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Minuto del día (en `timezone`) -> instante real, para la fecha dada.
 * Se arma desde números (ver src/lib/dates.ts): con un string sin offset,
 * en un servidor en UTC el turno quedaba guardado un día antes.
 */
export function minutesToInstant(dateISO: string, minutes: number, timezone: string): Date {
  return zonedInstant(dateISO, minutes, timezone);
}

/** Instante real -> minuto del día en `timezone` (asume que no cruza medianoche local). */
export function instantToMinutes(instant: string, timezone: string): number {
  return minutesOfDayInTz(new Date(instant), timezone);
}

/** Límites del día en `timezone`: [startUTC, endUTC) -- el fin es EXCLUSIVO (medianoche siguiente). */
export function dayBoundsUTC(dateISO: string, timezone: string) {
  const { start, end } = dayRange(dateISO, timezone);
  return { startUTC: start.toISOString(), endUTC: end.toISOString() };
}
