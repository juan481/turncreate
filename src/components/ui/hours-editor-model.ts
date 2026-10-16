// Lógica pura del editor de horarios (sin React): la usan el HoursEditor,
// el onboarding y la validación del lado servidor, así las reglas son las
// mismas en las tres puntas.

export type HourBlock = { opens_at: string; closes_at: string };
export type DayHours = { weekday: number; active: boolean; blocks: HourBlock[] };
/** Mismo shape que el payload que ya viajaba a los server actions de horarios. */
export type FlatHours = { weekday: number; opens_at: string; closes_at: string };

/** Horario partido: mañana + tarde. Más de dos franjas no lo pidió nadie y complica la pantalla. */
export const MAX_BLOCKS_PER_DAY = 2;

/** La semana arranca el lunes (0 = domingo, como Date#getDay y el resto del código). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const WEEKDAY_LABELS: Record<number, { short: string; long: string }> = {
  0: { short: "Dom", long: "Domingo" },
  1: { short: "Lun", long: "Lunes" },
  2: { short: "Mar", long: "Martes" },
  3: { short: "Mié", long: "Miércoles" },
  4: { short: "Jue", long: "Jueves" },
  5: { short: "Vie", long: "Viernes" },
  6: { short: "Sáb", long: "Sábado" },
};

export const DEFAULT_BLOCK: HourBlock = { opens_at: "09:00", closes_at: "18:00" };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTime(value: unknown): value is string {
  return typeof value === "string" && TIME.test(value);
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(total: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

function sortBlocks(blocks: HourBlock[]) {
  return [...blocks].sort((a, b) => a.opens_at.localeCompare(b.opens_at));
}

/** Lunes a viernes de 9 a 18; sábado y domingo cerrados. */
export function defaultWeek(): DayHours[] {
  return WEEK_ORDER.map((weekday) => ({
    weekday,
    active: weekday >= 1 && weekday <= 5,
    blocks: [{ ...DEFAULT_BLOCK }],
  }));
}

/** De la lista plana guardada (una fila por franja) a un día por fila, de lunes a domingo. */
export function hoursToDays(hours: FlatHours[], fallback: HourBlock = DEFAULT_BLOCK): DayHours[] {
  return WEEK_ORDER.map((weekday) => {
    const own = sortBlocks(
      hours
        .filter((hour) => hour.weekday === weekday)
        .map((hour) => ({ opens_at: hour.opens_at.slice(0, 5), closes_at: hour.closes_at.slice(0, 5) })),
    );
    return { weekday, active: own.length > 0, blocks: own.length > 0 ? own : [{ ...fallback }] };
  });
}

/** Solo los días abiertos, con las franjas ordenadas: es lo que se guarda. */
export function daysToHours(days: DayHours[]): FlatHours[] {
  return days
    .filter((day) => day.active)
    .flatMap((day) => sortBlocks(day.blocks).map((block) => ({ weekday: day.weekday, ...block })));
}

export function dayError(day: DayHours): string | null {
  if (!day.active) return null;
  if (day.blocks.length === 0) return "Agregá al menos una franja o marcá el día como cerrado.";
  if (day.blocks.some((block) => !isTime(block.opens_at) || !isTime(block.closes_at))) {
    return "Completá el horario de apertura y de cierre.";
  }
  if (day.blocks.some((block) => timeToMinutes(block.closes_at) <= timeToMinutes(block.opens_at))) {
    return "El cierre tiene que ser después de la apertura.";
  }
  const sorted = sortBlocks(day.blocks);
  for (let index = 1; index < sorted.length; index++) {
    if (timeToMinutes(sorted[index].opens_at) < timeToMinutes(sorted[index - 1].closes_at)) {
      return "Las franjas se pisan: la segunda tiene que arrancar después de que termine la primera.";
    }
  }
  return null;
}

/** Primer problema de la semana, o null si se puede guardar. */
export function weekError(days: DayHours[], { requireOpenDay = true } = {}): string | null {
  for (const day of days) {
    const error = dayError(day);
    if (error) return `${WEEKDAY_LABELS[day.weekday]?.long ?? "Un día"}: ${error}`;
  }
  if (requireOpenDay && !days.some((day) => day.active)) return "Abrí al menos un día para poder recibir turnos.";
  return null;
}

/** Validación de la lista plana que llega a un server action (no confía en el cliente). */
export function flatHoursError(hours: FlatHours[], options?: { requireOpenDay?: boolean }): string | null {
  if (!hours.every((hour) => Number.isInteger(hour.weekday) && hour.weekday >= 0 && hour.weekday <= 6)) {
    return "Hay un día de la semana inválido.";
  }
  const days = hoursToDays(hours);
  if (days.some((day) => day.blocks.length > MAX_BLOCKS_PER_DAY)) {
    return `Cada día admite hasta ${MAX_BLOCKS_PER_DAY} franjas.`;
  }
  return weekError(days, options);
}

function mapDay(days: DayHours[], weekday: number, change: (day: DayHours) => DayHours) {
  return days.map((day) => (day.weekday === weekday ? change(day) : day));
}

function isUntouchedDefault(day: DayHours) {
  return (
    day.blocks.length === 1 &&
    day.blocks[0].opens_at === DEFAULT_BLOCK.opens_at &&
    day.blocks[0].closes_at === DEFAULT_BLOCK.closes_at
  );
}

// Al abrir un día que nunca se tocó, arranca con el horario del día abierto
// anterior (el sábado que se abre copia al viernes). Si ya tenía un horario
// propio (se cerró sin querer), lo recupera tal cual.
export function setDayActive(days: DayHours[], weekday: number, active: boolean): DayHours[] {
  if (!active) return mapDay(days, weekday, (day) => ({ ...day, active: false }));
  const index = days.findIndex((day) => day.weekday === weekday);
  if (index === -1) return days;
  let source: DayHours | undefined;
  for (let step = 1; step < days.length && !source; step++) {
    const candidate = days[(index - step + days.length) % days.length];
    if (candidate.active) source = candidate;
  }
  return mapDay(days, weekday, (day) => ({
    ...day,
    active: true,
    blocks: source && isUntouchedDefault(day) ? source.blocks.map((block) => ({ ...block })) : day.blocks,
  }));
}

export function updateBlock(days: DayHours[], weekday: number, index: number, patch: Partial<HourBlock>): DayHours[] {
  return mapDay(days, weekday, (day) => ({
    ...day,
    blocks: day.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
  }));
}

/** Segunda franja sugerida después de la primera (por defecto 17 a 21), sin pisarla. */
export function suggestSecondBlock(first: HourBlock): HourBlock {
  const firstEnd = isTime(first.closes_at) ? timeToMinutes(first.closes_at) : 13 * 60;
  const start = Math.min(Math.max(17 * 60, firstEnd + 60), 22 * 60);
  return { opens_at: minutesToTime(start), closes_at: minutesToTime(Math.min(start + 4 * 60, 23 * 60 + 30)) };
}

export function addSplitBlock(days: DayHours[], weekday: number): DayHours[] {
  return mapDay(days, weekday, (day) =>
    day.blocks.length >= MAX_BLOCKS_PER_DAY
      ? day
      : { ...day, blocks: [...day.blocks, suggestSecondBlock(day.blocks[day.blocks.length - 1] ?? DEFAULT_BLOCK)] },
  );
}

export function removeSplitBlock(days: DayHours[], weekday: number): DayHours[] {
  return mapDay(days, weekday, (day) => ({ ...day, blocks: day.blocks.slice(0, 1) }));
}

/** Copia las franjas de `weekday` a los demás días ABIERTOS (los cerrados siguen cerrados). */
export function copyDayToOpenDays(days: DayHours[], weekday: number): DayHours[] {
  const source = days.find((day) => day.weekday === weekday);
  if (!source) return days;
  return days.map((day) =>
    day.weekday !== weekday && day.active ? { ...day, blocks: source.blocks.map((block) => ({ ...block })) } : day,
  );
}

/** ¿Dos listas planas describen exactamente los mismos horarios (sin importar el orden)? */
export function sameHours(a: FlatHours[], b: FlatHours[]) {
  const key = (hours: FlatHours[]) =>
    hours
      .map((hour) => `${hour.weekday}-${hour.opens_at.slice(0, 5)}-${hour.closes_at.slice(0, 5)}`)
      .sort()
      .join("|");
  return key(a) === key(b);
}
