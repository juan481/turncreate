import type { StatusDotTone } from "@/components/ui/status-dot";

/**
 * Mapeo único status de Firestore -> tone/label de `StatusDot`, compartido
 * entre la lista de 1 profesional (`simple-agenda-list.tsx`) y la lista
 * mobile con chips de equipo (`agenda-day-grid.tsx`) -- antes cada vista
 * tenía su propio mapeo parcial (uno usaba `StatusPill`, la pill gigante
 * que tapaba nombre/servicio en filas de lista, que es justamente el bug
 * que se está arreglando).
 */
const STATUS_MAP: Record<string, { tone: StatusDotTone; label: string }> = {
  confirmed: { tone: "confirmed", label: "Confirmado" },
  completed: { tone: "confirmed", label: "Completado" },
  pending_payment: { tone: "pending", label: "Pendiente" },
  cancelled: { tone: "neutral", label: "Cancelado" },
  no_show: { tone: "alert", label: "No vino" },
  expired: { tone: "draft", label: "Vencido" },
};

export function statusToneAndLabel(status: string): { tone: StatusDotTone; label: string } {
  return STATUS_MAP[status] ?? { tone: "neutral", label: status };
}

/** "HH:MM" a partir de minutos desde medianoche (0-1439). */
export function minutesToLabel(minute: number): string {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
