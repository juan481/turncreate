import type { TimeRange } from "./ranges";

/**
 * Sección 5.1: "Se recorre cada 15 minutos. Un inicio es válido si todos
 * los tramos activos más el buffer final caben en tiempo libre; las
 * esperas no necesitan estar libres."
 */
export type Phase = { kind: "active" | "wait"; minutes: number };

/**
 * Tramos que efectivamente ocupan al profesional para un inicio candidato:
 * fases "active" contiguas se fusionan en un segmento, las fases "wait" no
 * generan segmento (el profesional queda libre en ese hueco), y el buffer
 * final se pega al último segmento.
 *
 * Ejemplo del plan (30 aplicación, 40 espera, 20 lavado, 10 buffer, desde
 * las 10:00 = minuto 600): devuelve [{600,630}, {670,700}] -- 10:00-10:30
 * y 11:10-11:40, dejando 10:30-11:10 libre para otro cliente.
 */
export function computeOccupiedSegments(
  candidateStart: number,
  phases: Phase[],
  bufferAfterMin: number,
): TimeRange[] {
  const segments: TimeRange[] = [];
  let cursor = candidateStart;
  let activeStart: number | null = null;

  for (const phase of phases) {
    if (phase.kind === "active") {
      if (activeStart === null) activeStart = cursor;
    } else if (activeStart !== null) {
      segments.push({ start: activeStart, end: cursor });
      activeStart = null;
    }
    cursor += phase.minutes;
  }

  if (activeStart !== null) {
    segments.push({ start: activeStart, end: cursor });
  }

  if (bufferAfterMin > 0) {
    const last = segments[segments.length - 1];
    if (last && last.end === cursor) {
      last.end = cursor + bufferAfterMin;
    } else {
      segments.push({ start: cursor, end: cursor + bufferAfterMin });
    }
  }

  return segments;
}

/** Duración total del turno para el cliente (incluye esperas y buffer). */
export function computeTotalDuration(phases: Phase[], bufferAfterMin: number): number {
  return phases.reduce((sum, phase) => sum + phase.minutes, 0) + bufferAfterMin;
}

/** Cada segmento ocupado debe caer completo dentro de una única ventana libre. */
export function isCandidateAvailable(
  occupiedSegments: TimeRange[],
  freeWindows: TimeRange[],
): boolean {
  return occupiedSegments.every((segment) =>
    freeWindows.some((window) => segment.start >= window.start && segment.end <= window.end),
  );
}
