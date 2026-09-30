"use server";

import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { minutesToInstant } from "@/server/availability";
import { createInternalAppointment } from "@/server/firebase/booking";

export type MoveAppointmentResult = { error: string | null };

/**
 * Mueve un turno por drag & drop en la grilla. Sección 5.3: cambiar el
 * horario de un turno confirmado es una reprogramación (turno nuevo +
 * cancelar el original con historial), no un update directo de
 * startsAt/staffId -- reusa exactamente el mismo mecanismo (createInternalAppointment
 * con rescheduledFromId) que el botón "Reprogramar" de la ficha de turno.
 */
export async function moveAppointment(
  tenantSlug: string,
  params: { appointmentId: string; newStaffId: string; newStartMinute: number; dateISO: string },
): Promise<MoveAppointmentResult> {
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return { error: "El local no existe" };

  const appointmentRef = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments").doc(params.appointmentId);
  const appointmentDoc = await appointmentRef.get();
  if (!appointmentDoc.exists) return { error: "El turno no existe" };
  const appointment = appointmentDoc.data()!;

  if (appointment.status !== "confirmed" && appointment.status !== "pending_payment") {
    return { error: "Solo se pueden mover turnos pendientes o confirmados" };
  }

  const items = (appointment.items ?? []) as { serviceId: string; name: string; price: number }[];
  const serviceId = items[0]?.serviceId;
  if (!serviceId) return { error: "No se pudo determinar el servicio del turno" };

  const startsAt = minutesToInstant(params.dateISO, params.newStartMinute, tenant.timezone);

  try {
    await createInternalAppointment({
      tenantId: tenant.id,
      tenant,
      serviceId,
      staffId: params.newStaffId,
      startsAtISO: startsAt.toISOString(),
      clientId: String(appointment.clientId),
      clientName: String(appointment.clientName),
      clientPhone: String(appointment.clientPhone),
      clientEmail: appointment.clientEmail ?? null,
      depositAmount: Number(appointment.depositPaid ?? 0),
      rescheduledFromId: params.appointmentId,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo mover el turno" };
  }

  return { error: null };
}
