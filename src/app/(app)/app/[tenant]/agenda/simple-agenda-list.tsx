import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { Icon } from "@/components/ui/icon";

const STATUS_LABEL: Record<string, { label: string; pill: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente", pill: "pending" },
  confirmed: { label: "Confirmado", pill: "confirmed" },
  completed: { label: "Completado", pill: "confirmed" },
  no_show: { label: "No vino", pill: "alert" },
};

function minutesToLabel(minute: number) {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

type Appointment = {
  id: string;
  startMinute: number;
  endMinute: number;
  status: string;
  clientName: string;
  serviceNames: string;
  total: number;
};

/**
 * Con un solo profesional, la grilla de calendario con columnas y drag &
 * drop no aporta nada -- no hay entre quién repartir turnos. Una lista
 * simple ordenada por hora es más clara y no se corta en pantallas
 * angostas como pasaba con las tarjetas de ancho fijo del calendario.
 */
export function SimpleAgendaList({
  tenantSlug,
  appointments,
}: {
  tenantSlug: string;
  appointments: Appointment[];
}) {
  if (appointments.length === 0) {
    return (
      <Card hoverLift={false} className="flex flex-col items-center gap-2 p-xl text-center">
        <Icon name="event_available" className="text-[28px] text-on-surface-variant" />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No hay turnos agendados para este día.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {appointments.map((a) => {
        const status = STATUS_LABEL[a.status] ?? { label: a.status, pill: "pending" as StatusPillStatus };
        return (
          <Link key={a.id} href={`/app/${tenantSlug}/agenda/${a.id}`}>
            <Card className="flex items-center gap-4 p-lg">
              <div className="flex w-16 shrink-0 flex-col items-start">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  {minutesToLabel(a.startMinute)}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {minutesToLabel(a.endMinute)}
                </span>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-lg text-label-lg text-on-surface">{a.clientName}</p>
                <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{a.serviceNames}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-label-md text-label-md text-on-surface">
                  ${a.total.toLocaleString("es-AR")}
                </span>
                <StatusPill status={status.pill}>{status.label}</StatusPill>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
