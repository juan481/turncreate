import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Punto de color + texto chico, para filas densas (lista de turnos,
 * historial de cliente) donde el `StatusPill` (pill de 24px con fondo
 * tintado) competía demasiado con el nombre/servicio -- en mobile se
 * veía un "Confirmado" enorme y el resto de la fila quedaba apretado.
 * `StatusPill` sigue siendo el correcto para headers y detalle de turno,
 * donde el estado es protagonista.
 */
const DOT_STYLES = {
  confirmed: { dot: "bg-status-confirmed-dot", text: "text-status-confirmed" },
  pending: { dot: "bg-status-pending-dot", text: "text-status-pending" },
  alert: { dot: "bg-status-alert-dot", text: "text-status-alert" },
  draft: { dot: "bg-status-draft-dot", text: "text-status-draft" },
  neutral: { dot: "bg-on-surface-variant", text: "text-on-surface-variant" },
} as const;

export type StatusDotTone = keyof typeof DOT_STYLES;

export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: StatusDotTone;
  children: ReactNode;
  className?: string;
}) {
  const styles = DOT_STYLES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-label-sm text-label-sm", styles.text, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} />
      <span className="truncate">{children}</span>
    </span>
  );
}
