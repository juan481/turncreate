import { intersectRanges, subtractRanges, type TimeRange } from "./ranges";
import { computeOccupiedSegments, isCandidateAvailable, type Phase } from "./segments";

/**
 * Sección 5.1: "Ventana = business_hours ∩ staff_schedules vigentes. Se
 * restan time_blocks del local y del profesional, y feriados si el local
 * no los trabaja. Se restan los appointment_segments de turnos confirmados
 * y holds no vencidos."
 */
export function computeFreeWindows(params: {
  businessHours: TimeRange[];
  staffSchedule: TimeRange[];
  busyRanges: TimeRange[];
}): TimeRange[] {
  const window = intersectRanges(params.businessHours, params.staffSchedule);
  return subtractRanges(window, params.busyRanges);
}

export type AvailableSlotsParams = {
  freeWindows: TimeRange[];
  phases: Phase[];
  bufferAfterMin: number;
  slotIntervalMin: number;
  /** Minuto del día a partir del cual se puede reservar (anticipación mínima ya resuelta por el caller). */
  earliestStart?: number;
};

/**
 * "Se recorre cada 15 minutos (slot_interval_min)." Los candidatos se
 * alinean a múltiplos de slotIntervalMin desde medianoche (no desde la
 * hora exacta de apertura), para que los horarios ofrecidos caigan
 * siempre en valores redondos (:00, :15, :30...).
 */
export function computeAvailableSlots(params: AvailableSlotsParams): number[] {
  if (params.freeWindows.length === 0) return [];

  const dayStart = Math.min(...params.freeWindows.map((w) => w.start));
  const dayEnd = Math.max(...params.freeWindows.map((w) => w.end));
  const alignedStart = Math.ceil(dayStart / params.slotIntervalMin) * params.slotIntervalMin;

  const results: number[] = [];
  for (let start = alignedStart; start < dayEnd; start += params.slotIntervalMin) {
    if (params.earliestStart !== undefined && start < params.earliestStart) continue;

    const segments = computeOccupiedSegments(start, params.phases, params.bufferAfterMin);
    if (segments.length === 0) continue;
    if (isCandidateAvailable(segments, params.freeWindows)) {
      results.push(start);
    }
  }

  return results;
}

/** Sección 5.1: "Con 'Cualquiera' ... se unen los slots ..." */
export function unionAnyStaffSlots(perStaffSlots: { staffId: string; slots: number[] }[]): number[] {
  const set = new Set<number>();
  for (const { slots } of perStaffSlots) {
    for (const slot of slots) set.add(slot);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** "... y se asigna al que tenga menos minutos ocupados ese día." */
export function pickLeastBusyStaff(
  candidates: { staffId: string; busyMinutes: number }[],
): string | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((least, c) => (c.busyMinutes < least.busyMinutes ? c : least)).staffId;
}
