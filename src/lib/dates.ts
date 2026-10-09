import { TZDate } from "@date-fns/tz";

/**
 * Helpers de fecha con zona horaria explícita.
 *
 * Regla de oro: NUNCA construir un TZDate a partir de un string sin offset
 * (`new TZDate("2026-10-10T00:00:00", tz)`). @date-fns/tz lo parsea con
 * `new Date(texto)`, que usa la zona horaria DEL PROCESO, no `tz`. En el
 * VPS (UTC) eso guardaba cada turno un día antes. Acá todo se arma desde
 * números (año, mes, día, hora), que sí se interpretan en `tz`.
 */

const DATE_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateISO(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ISO_RE.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** "YYYY-MM-DD" -> [año, mesIndex0, día]. Tira si el formato no es válido. */
export function parseDateISO(dateISO: string): [number, number, number] {
  const match = DATE_ISO_RE.exec(dateISO);
  if (!match) throw new Error(`Fecha inválida: ${dateISO}`);
  return [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
}

/** Instante real de "dateISO a las HH:MM (minutos desde medianoche)" en `timezone`. */
export function zonedInstant(dateISO: string, minutes: number, timezone: string): Date {
  const [y, m, d] = parseDateISO(dateISO);
  return new Date(+new TZDate(y, m, d, Math.floor(minutes / 60), minutes % 60, 0, 0, timezone));
}

/** Medianoche (inicio del día) de dateISO en `timezone`. */
export function startOfDayInTz(dateISO: string, timezone: string): Date {
  return zonedInstant(dateISO, 0, timezone);
}

/** Suma días calendario a una fecha "YYYY-MM-DD" (sin tocar zonas horarias). */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = parseDateISO(dateISO);
  const date = new Date(Date.UTC(y, m, d + days));
  return date.toISOString().slice(0, 10);
}

/** Rango [start, end) del día en `timezone` -- usar `< end` en las queries. */
export function dayRange(dateISO: string, timezone: string): { start: Date; end: Date } {
  return { start: startOfDayInTz(dateISO, timezone), end: startOfDayInTz(addDaysISO(dateISO, 1), timezone) };
}

/** Día de la semana (0 = domingo) de una fecha calendario. No depende de zona horaria. */
export function weekdayOf(dateISO: string): number {
  const [y, m, d] = parseDateISO(dateISO);
  return new Date(Date.UTC(y, m, d)).getUTCDay();
}

/** Lunes de la semana de dateISO. */
export function startOfWeekISO(dateISO: string): string {
  const weekday = weekdayOf(dateISO);
  return addDaysISO(dateISO, weekday === 0 ? -6 : 1 - weekday);
}

/** Rango [lunes, lunes siguiente) en `timezone`. */
export function weekRange(dateISO: string, timezone: string) {
  const monday = startOfWeekISO(dateISO);
  return { startISO: monday, start: startOfDayInTz(monday, timezone), end: startOfDayInTz(addDaysISO(monday, 7), timezone) };
}

/** Primer día del mes ("YYYY-MM-01") de dateISO. */
export function startOfMonthISO(dateISO: string): string {
  return `${dateISO.slice(0, 7)}-01`;
}

/** Suma meses a una fecha "YYYY-MM-01". */
export function addMonthsISO(monthISO: string, months: number): string {
  const [y, m] = parseDateISO(startOfMonthISO(monthISO));
  const date = new Date(Date.UTC(y, m + months, 1));
  return date.toISOString().slice(0, 10);
}

/** Cantidad de días del mes de dateISO. */
export function daysInMonth(dateISO: string): number {
  const [y, m] = parseDateISO(dateISO);
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Rango [día 1, día 1 del mes siguiente) en `timezone`. */
export function monthRange(dateISO: string, timezone: string) {
  const first = startOfMonthISO(dateISO);
  return { startISO: first, start: startOfDayInTz(first, timezone), end: startOfDayInTz(addMonthsISO(first, 1), timezone) };
}

/** "YYYY-MM-DD" de un instante visto en `timezone`. */
export function toDateISOInTz(instant: Date, timezone: string): string {
  const zoned = new TZDate(instant, timezone);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha de hoy ("YYYY-MM-DD") en `timezone`. */
export function todayISO(timezone: string, now: Date = new Date()): string {
  return toDateISOInTz(now, timezone);
}

/** Minuto del día (0-1439) de un instante visto en `timezone`. */
export function minutesOfDayInTz(instant: Date, timezone: string): number {
  const zoned = new TZDate(instant, timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

/** "HH:MM" de un instante en `timezone`. */
export function formatTimeInTz(instant: Date | string, timezone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const minutes = minutesOfDayInTz(date, timezone);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** toLocaleString es-AR forzando la zona del local (nunca la del servidor ni la del navegador). */
export function formatInTz(instant: Date | string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("es-AR", { ...options, timeZone: timezone }).format(date);
}

const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "Sábado 10 de octubre" -- de una fecha calendario, sin zonas horarias de por medio. */
export function longDayLabel(dateISO: string, { capital = true }: { capital?: boolean } = {}): string {
  const [, m, d] = parseDateISO(dateISO);
  const label = `${WEEKDAYS_LONG[weekdayOf(dateISO)]} ${d} de ${MONTHS_LONG[m]}`;
  return capital ? capitalize(label) : label;
}

/** "Sáb" */
export function shortWeekdayLabel(dateISO: string): string {
  return WEEKDAYS_SHORT[weekdayOf(dateISO)];
}

/** "Octubre 2026" */
export function monthLabel(dateISO: string): string {
  const [y, m] = parseDateISO(dateISO);
  return `${capitalize(MONTHS_LONG[m])} ${y}`;
}

/** "oct" */
export function shortMonthLabel(dateISO: string): string {
  const [, m] = parseDateISO(dateISO);
  return MONTHS_SHORT[m];
}

/** "10/10" */
export function dayMonthLabel(dateISO: string): string {
  const [, m, d] = parseDateISO(dateISO);
  return `${d}/${m + 1}`;
}
