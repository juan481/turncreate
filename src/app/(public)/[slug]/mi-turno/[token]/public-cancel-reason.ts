/**
 * Motivo de cancelación que ve la clienta en "Mi turno". Nunca se muestra el
 * texto libre que escribió la dueña (`cancelReason`): puede tener notas
 * internas. Sale solo de campos del sistema: `cancelSource` (turnos nuevos)
 * o, en turnos viejos, los textos fijos que escribía el propio sistema.
 */
export type CancelSource = "client" | "owner" | "transfer_expired" | "transfer_rejected" | "rescheduled";

const LEGACY_SYSTEM_REASONS: Record<string, CancelSource> = {
  "Cancelado por la clienta": "client",
  "No se confirmó la transferencia de la seña a tiempo": "transfer_expired",
  "La transferencia de la seña no llegó": "transfer_rejected",
  Reprogramado: "rescheduled",
};

const PUBLIC_REASON: Record<CancelSource, string> = {
  client: "Cancelaste este turno.",
  transfer_expired: "La transferencia de la seña no llegó a tiempo y el horario se liberó.",
  transfer_rejected: "El local no recibió la transferencia de la seña y el horario se liberó.",
  rescheduled: "El local cambió este turno por otro horario.",
  owner: "El local canceló este turno.",
};

export function cancelSourceOf(data: { cancelSource?: unknown; cancelReason?: unknown }): CancelSource {
  if (typeof data.cancelSource === "string" && Object.hasOwn(PUBLIC_REASON, data.cancelSource)) return data.cancelSource as CancelSource;
  if (typeof data.cancelReason === "string" && Object.hasOwn(LEGACY_SYSTEM_REASONS, data.cancelReason)) {
    return LEGACY_SYSTEM_REASONS[data.cancelReason];
  }
  return "owner";
}

export function publicCancelReason(data: { cancelSource?: unknown; cancelReason?: unknown }): string {
  return PUBLIC_REASON[cancelSourceOf(data)];
}
