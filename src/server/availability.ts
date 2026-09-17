import { TZDate } from "@date-fns/tz";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeAvailableSlots,
  computeFreeWindows,
  computeOccupiedSegments,
  computeTotalDuration,
  pickLeastBusyStaff,
  isCandidateAvailable,
  type Phase,
  type TimeRange,
} from "@/domain/availability";
import type { Database } from "@/lib/database.types";

/** "HH:MM:SS" (columnas `time` de Postgres) -> minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Minuto del día (en `timezone`) -> instante real, para la fecha dada. */
function minutesToInstant(dateISO: string, minutes: number, timezone: string): Date {
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

export type ServiceCombo = {
  phases: Phase[];
  bufferAfterMin: number;
  totalPrice: number;
  items: { serviceId: string; name: string; price: number; phases: Phase[]; bufferAfterMin: number }[];
};

/**
 * Profesionales activos del tenant que dictan un servicio, según
 * staff_services (sección 3.3). Sin este filtro, el combo "Cualquiera"
 * podía asignar un turno a alguien que no sabe hacer el servicio
 * elegido -- staff_services existía en el schema desde la Fase 0 pero
 * ningún flujo de reserva lo consultaba todavía.
 */
export async function getStaffIdsForService(
  supabase: SupabaseClient<Database>,
  params: { tenantId: string; serviceId: string },
): Promise<string[]> {
  const { data, error } = await supabase
    .from("staff_services")
    .select("staff_id, staff(tenant_id, active)")
    .eq("service_id", params.serviceId);

  if (error) throw error;

  return data
    .filter((row) => row.staff?.tenant_id === params.tenantId && row.staff?.active)
    .map((row) => row.staff_id);
}

/** Trae los servicios elegidos y concatena sus fases en el orden pedido (combo). */
export async function getServiceCombo(
  supabase: SupabaseClient<Database>,
  serviceIds: string[],
): Promise<ServiceCombo> {
  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, price, buffer_after_min, service_phases(position, kind, minutes)")
    .in("id", serviceIds);

  if (error) throw error;

  const byId = new Map((services ?? []).map((s) => [s.id, s]));
  const items = serviceIds.map((id) => {
    const service = byId.get(id);
    if (!service) throw new Error(`Servicio ${id} no encontrado`);

    const phases: Phase[] = [...(service.service_phases ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ kind: p.kind as Phase["kind"], minutes: p.minutes }));

    return {
      serviceId: service.id,
      name: service.name,
      price: Number(service.price),
      phases,
      bufferAfterMin: service.buffer_after_min,
    };
  });

  return {
    phases: items.flatMap((i) => i.phases),
    bufferAfterMin: items.reduce((sum, i) => sum + i.bufferAfterMin, 0),
    totalPrice: items.reduce((sum, i) => sum + i.price, 0),
    items,
  };
}

/**
 * Sección 5.1: arma la ventana libre real de un profesional para un día,
 * consultando business_hours ∩ staff_schedules, restando time_blocks
 * (locales y del profesional) y los appointment_segments ya ocupados.
 * Feriados quedan para cuando exista la UI que marca "el local no trabaja
 * ese feriado" (tenant_settings no tiene ese flag todavía).
 */
export async function getStaffFreeWindows(
  supabase: SupabaseClient<Database>,
  params: { tenantId: string; staffId: string; dateISO: string; timezone: string },
): Promise<TimeRange[]> {
  const weekday = new TZDate(`${params.dateISO}T12:00:00`, params.timezone).getDay();
  const { startUTC, endUTC } = dayBoundsUTC(params.dateISO, params.timezone);

  const [businessHoursRes, staffScheduleRes, timeBlocksRes, segmentsRes] = await Promise.all([
    supabase
      .from("business_hours")
      .select("opens_at, closes_at")
      .eq("tenant_id", params.tenantId)
      .eq("weekday", weekday),
    supabase
      .from("staff_schedules")
      .select("starts_at, ends_at, valid_from, valid_to")
      .eq("staff_id", params.staffId)
      .eq("weekday", weekday)
      .lte("valid_from", params.dateISO)
      .or(`valid_to.is.null,valid_to.gte.${params.dateISO}`),
    supabase
      .from("time_blocks")
      .select("starts_at, ends_at, staff_id")
      .eq("tenant_id", params.tenantId)
      .or(`staff_id.eq.${params.staffId},staff_id.is.null`)
      .lt("starts_at", endUTC)
      .gt("ends_at", startUTC),
    supabase
      .from("appointment_segments")
      .select("period")
      .eq("staff_id", params.staffId)
      .overlaps("period", `[${startUTC},${endUTC})`),
  ]);

  if (businessHoursRes.error) throw businessHoursRes.error;
  if (staffScheduleRes.error) throw staffScheduleRes.error;
  if (timeBlocksRes.error) throw timeBlocksRes.error;
  if (segmentsRes.error) throw segmentsRes.error;

  const businessHours: TimeRange[] = businessHoursRes.data.map((r) => ({
    start: timeToMinutes(r.opens_at),
    end: timeToMinutes(r.closes_at),
  }));

  const staffSchedule: TimeRange[] = staffScheduleRes.data.map((r) => ({
    start: timeToMinutes(r.starts_at),
    end: timeToMinutes(r.ends_at),
  }));

  const busyFromBlocks: TimeRange[] = timeBlocksRes.data.map((r) => ({
    start: Math.max(0, instantToMinutes(r.starts_at, params.timezone)),
    end: Math.min(24 * 60, instantToMinutes(r.ends_at, params.timezone)),
  }));

  // period viene como "[2026-10-01 10:00:00+00,2026-10-01 10:30:00+00)".
  // Supabase no tiene un tipo TS nativo para tstzrange, llega como unknown.
  const busyFromSegments: TimeRange[] = segmentsRes.data.map((r) => {
    const [start, end] = (r.period as string).replace(/[[\])]/g, "").split(",");
    return {
      start: Math.max(0, instantToMinutes(start, params.timezone)),
      end: Math.min(24 * 60, instantToMinutes(end, params.timezone)),
    };
  });

  return computeFreeWindows({
    businessHours,
    staffSchedule,
    busyRanges: [...busyFromBlocks, ...busyFromSegments],
  });
}

export type AvailableSlot = { startsAt: Date; endsAt: Date };

/** Slots disponibles de un profesional para un servicio/combo y un día. */
export async function getAvailableSlotsForStaff(
  supabase: SupabaseClient<Database>,
  params: {
    tenantId: string;
    staffId: string;
    dateISO: string;
    timezone: string;
    combo: ServiceCombo;
    slotIntervalMin: number;
    minNoticeMin: number;
    now?: Date;
  },
): Promise<AvailableSlot[]> {
  const freeWindows = await getStaffFreeWindows(supabase, params);

  const now = params.now ?? new Date();
  const today = new TZDate(now, params.timezone);
  const isToday = params.dateISO === today.toISOString().slice(0, 10);
  const earliestStart = isToday
    ? instantToMinutes(now.toISOString(), params.timezone) + params.minNoticeMin
    : undefined;

  const startMinutes = computeAvailableSlots({
    freeWindows,
    phases: params.combo.phases,
    bufferAfterMin: params.combo.bufferAfterMin,
    slotIntervalMin: params.slotIntervalMin,
    earliestStart,
  });

  const totalDuration = computeTotalDuration(params.combo.phases, params.combo.bufferAfterMin);

  return startMinutes.map((startMinute) => ({
    startsAt: minutesToInstant(params.dateISO, startMinute, params.timezone),
    endsAt: minutesToInstant(params.dateISO, startMinute + totalDuration, params.timezone),
  }));
}

/**
 * Tramos que ocupan al profesional para un inicio elegido, ya como
 * instantes reales -- lo que create_staff_appointment persiste en
 * appointment_segments (el EXCLUDE constraint de la base es el árbitro
 * final contra condiciones de carrera, sección 5.2).
 */
export function computeSegmentInstants(params: {
  dateISO: string;
  startMinute: number;
  combo: ServiceCombo;
  timezone: string;
}): { startsAt: Date; endsAt: Date }[] {
  const segments = computeOccupiedSegments(
    params.startMinute,
    params.combo.phases,
    params.combo.bufferAfterMin,
  );

  return segments.map((segment) => ({
    startsAt: minutesToInstant(params.dateISO, segment.start, params.timezone),
    endsAt: minutesToInstant(params.dateISO, segment.end, params.timezone),
  }));
}
export async function assignAnyStaffForSlot(
  supabase: SupabaseClient<Database>,
  params: {
    tenantId: string;
    dateISO: string;
    timezone: string;
    combo: ServiceCombo;
    startMinute: number;
    staffIds: string[];
  }
): Promise<string | null> {
  const candidates: { staffId: string; busyMinutes: number }[] = [];
  const { startUTC, endUTC } = dayBoundsUTC(params.dateISO, params.timezone);

  for (const staffId of params.staffIds) {
    const freeWindows = await getStaffFreeWindows(supabase, { ...params, staffId });
    const segments = computeOccupiedSegments(params.startMinute, params.combo.phases, params.combo.bufferAfterMin);
    
    if (segments.length > 0 && isCandidateAvailable(segments, freeWindows)) {
      const { data } = await supabase.from("appointment_segments")
          .select("period")
          .eq("staff_id", staffId)
          .overlaps("period", `[${startUTC},${endUTC})`);
      
      let busyMinutes = 0;
      for (const row of (data || [])) {
         const [start, end] = (row.period as string).replace(/[[\])]/g, "").split(",");
         const startMin = Math.max(0, instantToMinutes(start, params.timezone));
         const endMin = Math.min(24 * 60, instantToMinutes(end, params.timezone));
         busyMinutes += (endMin - startMin);
      }
      candidates.push({ staffId, busyMinutes });
    }
  }
  
  return pickLeastBusyStaff(candidates);
}
