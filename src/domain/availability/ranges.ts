/**
 * Álgebra de rangos de tiempo, representados en minutos desde medianoche
 * ([start, end), start < end). La resolución de fechas reales, zona
 * horaria y "ahora" vive en src/server (date-fns/tz) -- estas funciones
 * son puras y no conocen el reloj ni el calendario.
 */
export type TimeRange = { start: number; end: number };

function byStart(a: TimeRange, b: TimeRange) {
  return a.start - b.start;
}

/** Ordena y fusiona rangos solapados o contiguos. */
export function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  const sorted = [...ranges].sort(byStart);
  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }

  return merged;
}

/** Intersección de dos conjuntos de rangos (p. ej. business_hours ∩ staff_schedules). */
export function intersectRanges(a: TimeRange[], b: TimeRange[]): TimeRange[] {
  const mergedA = mergeRanges(a);
  const mergedB = mergeRanges(b);
  const result: TimeRange[] = [];

  for (const rangeA of mergedA) {
    for (const rangeB of mergedB) {
      const start = Math.max(rangeA.start, rangeB.start);
      const end = Math.min(rangeA.end, rangeB.end);
      if (start < end) result.push({ start, end });
    }
  }

  return result;
}

/** Resta `busy` de `free` (p. ej. restar time_blocks y turnos ya ocupados). */
export function subtractRanges(free: TimeRange[], busy: TimeRange[]): TimeRange[] {
  const mergedBusy = mergeRanges(busy);
  let result = mergeRanges(free);

  for (const b of mergedBusy) {
    const next: TimeRange[] = [];
    for (const f of result) {
      if (b.end <= f.start || b.start >= f.end) {
        // Sin superposición.
        next.push(f);
        continue;
      }
      if (b.start > f.start) next.push({ start: f.start, end: Math.min(b.start, f.end) });
      if (b.end < f.end) next.push({ start: Math.max(b.end, f.start), end: f.end });
    }
    result = next;
  }

  return result;
}
