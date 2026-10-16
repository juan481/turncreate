import { addDaysISO } from "@/lib/dates";

/** Días a cada lado de hoy que ofrece el dial (siempre incluye el día elegido). */
export const DIAL_RANGE_DAYS = 60;
/** Días mínimos a cada lado del día elegido (para poder scrollear un poco aunque esté lejos de hoy). */
const DIAL_CONTEXT_DAYS = 7;

/**
 * Primer y último día del dial: ±60 días alrededor de hoy, estirado para
 * incluir el día elegido ±7, pero NUNCA más de ±60 días alrededor del día
 * elegido. Sin ese tope, `?date=9999-12-31` (o 2020-01-01) armaba un dial
 * con millones (o miles) de días en el servidor.
 */
export function dialBounds(dateISO: string, todayISO: string): { minISO: string; maxISO: string } {
  const wideMin = [addDaysISO(todayISO, -DIAL_RANGE_DAYS), addDaysISO(dateISO, -DIAL_CONTEXT_DAYS)].sort()[0];
  const wideMax = [addDaysISO(todayISO, DIAL_RANGE_DAYS), addDaysISO(dateISO, DIAL_CONTEXT_DAYS)].sort()[1];
  const capMin = addDaysISO(dateISO, -DIAL_RANGE_DAYS);
  const capMax = addDaysISO(dateISO, DIAL_RANGE_DAYS);
  return { minISO: wideMin < capMin ? capMin : wideMin, maxISO: wideMax > capMax ? capMax : wideMax };
}

/** Hasta dónde (en días, para cada lado de hoy) se puede navegar la agenda por ?date=. */
export const AGENDA_MAX_DAYS_FROM_TODAY = 3650;

/**
 * `?date=` de la agenda acotado a ±10 años de hoy. Un año absurdo
 * (`9999-12-31`, `0001-01-01`) rompía la aritmética de fechas: sumarle días
 * a 9999-12-31 da el año 10000, que `toISOString()` escribe "+010000-...".
 */
export function clampAgendaDateISO(dateISO: string, todayISO: string): string {
  const min = addDaysISO(todayISO, -AGENDA_MAX_DAYS_FROM_TODAY);
  const max = addDaysISO(todayISO, AGENDA_MAX_DAYS_FROM_TODAY);
  return dateISO < min ? min : dateISO > max ? max : dateISO;
}
