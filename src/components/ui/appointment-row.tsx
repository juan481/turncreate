import Link from "next/link";
import { Avatar } from "./avatar";
import { StatusDot, type StatusDotTone } from "./status-dot";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de turno para listas mobile (agenda del día, home, historial
 * de cliente). Jerarquía deliberada, al revés de como estaba: el NOMBRE
 * de la clienta es lo más grande después de la hora, el servicio va
 * debajo bien legible, y el estado es un punto chico -- antes la pill de
 * estado (24px, fondo tintado) le ganaba el protagonismo al nombre.
 */
export function AppointmentRow({
  href,
  time,
  durationLabel,
  clientName,
  clientPhoto,
  serviceName,
  staffName,
  statusTone,
  statusLabel,
  price,
  className,
}: {
  href: string;
  time: string;
  durationLabel?: string;
  clientName: string;
  clientPhoto?: string | null;
  serviceName: string;
  staffName?: string;
  statusTone: StatusDotTone;
  statusLabel: string;
  price?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-inner border border-border bg-surface p-3 transition-colors active:bg-surface-container-low",
        className,
      )}
    >
      <div className="flex w-12 shrink-0 flex-col items-center">
        <span className="font-label-lg text-label-lg tabular-nums text-on-surface">{time}</span>
        {durationLabel && (
          <span className="font-label-sm text-label-sm tabular-nums text-on-surface-variant">{durationLabel}</span>
        )}
      </div>
      <Avatar name={clientName} src={clientPhoto} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-label-lg text-label-lg text-on-surface">{clientName}</p>
        <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
          {serviceName}
          {staffName && <span className="text-on-surface-variant"> · {staffName}</span>}
        </p>
        <StatusDot tone={statusTone} className="mt-0.5">
          {statusLabel}
        </StatusDot>
      </div>
      {price && <span className="shrink-0 font-label-lg text-label-lg tabular-nums text-on-surface">{price}</span>}
    </Link>
  );
}
