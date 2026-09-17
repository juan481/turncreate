"use server";

import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { computeSegmentInstants, minutesToInstant } from "@/server/availability";
import { computeTotalDuration, type Phase } from "@/domain/availability";

export type MoveAppointmentResult = { error: string | null };

/**
 * Mueve un turno por drag & drop en la grilla. Sección 5.3: cambiar el
 * horario de un turno confirmado es una reprogramación (turno nuevo +
 * cancelar el original con historial), no un UPDATE directo de
 * starts_at/staff_id -- reusa exactamente el mismo mecanismo que el
 * botón "Reprogramar" de la ficha de turno.
 */
export async function moveAppointment(
  tenantSlug: string,
  params: { appointmentId: string; newStaffId: string; newStartMinute: number; dateISO: string },
): Promise<MoveAppointmentResult> {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, client_id, status, appointment_items(service_id, name, price, phases, buffer_min)")
    .eq("id", params.appointmentId)
    .eq("tenant_id", tenant.id)
    .single();

  if (appointmentError) {
    return { error: appointmentError.message };
  }
  if (appointment.status !== "confirmed" && appointment.status !== "pending_payment") {
    return { error: "Solo se pueden mover turnos pendientes o confirmados" };
  }

  const items = appointment.appointment_items;
  const phases = items.flatMap((i) => i.phases as unknown as Phase[]);
  const bufferAfterMin = items.reduce((sum, i) => sum + i.buffer_min, 0);

  const segments = computeSegmentInstants({
    dateISO: params.dateISO,
    startMinute: params.newStartMinute,
    combo: { phases, bufferAfterMin, totalPrice: 0, items: [] },
    timezone: tenant.timezone,
  });

  if (segments.length === 0) {
    return { error: "No se pudo calcular el nuevo horario" };
  }

  const startsAt = minutesToInstant(params.dateISO, params.newStartMinute, tenant.timezone);
  const totalDuration = computeTotalDuration(phases, bufferAfterMin);
  const endsAt = minutesToInstant(params.dateISO, params.newStartMinute + totalDuration, tenant.timezone);

  const { error } = await supabase.rpc("create_staff_appointment", {
    p_tenant_id: tenant.id,
    p_staff_id: params.newStaffId,
    p_client_id: appointment.client_id,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_items: items.map((item) => ({
      service_id: item.service_id,
      name: item.name,
      price: item.price,
      phases: item.phases,
      buffer_min: item.buffer_min,
    })),
    p_segments: segments.map((s) => ({
      starts_at: s.startsAt.toISOString(),
      ends_at: s.endsAt.toISOString(),
    })),
    p_rescheduled_from_id: params.appointmentId,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
