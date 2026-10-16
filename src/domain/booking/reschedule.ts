/**
 * ¿Se puede reprogramar / mover este turno? Regla única que usan la ficha
 * del turno ("Reprogramar"), el drag & drop de la agenda, la pantalla
 * "Nuevo turno" con ?rescheduleFrom= y, como última palabra, la transacción
 * de createInternalAppointment (que relee el turno original adentro).
 *
 * Solo turnos `confirmed` o `pending_payment`, y nunca uno que espera una
 * transferencia: moverlo lo "confirmaría" sin seña y dejaría colgado su
 * pendiente (la dueña tiene que confirmarla o rechazarla primero).
 * Devuelve el mensaje para mostrar, o null si se puede.
 */
export function rescheduleBlockReason(appointment: { status?: unknown; awaitingTransfer?: unknown } | null | undefined): string | null {
  if (!appointment) return "El turno original ya no existe";
  const status = String(appointment.status ?? "");
  if (status === "pending_payment" && appointment.awaitingTransfer === true) {
    return "Este turno espera la transferencia de la seña: confirmala o rechazala en Transferencias antes de moverlo";
  }
  if (status === "confirmed" || status === "pending_payment") return null;
  if (status === "cancelled") return "Este turno ya está cancelado, no se puede mover";
  if (status === "expired") return "Este turno ya venció, no se puede mover";
  return "Solo se pueden mover turnos pendientes o confirmados";
}
