import Link from "next/link";
import { AppointmentRow } from "@/components/ui/appointment-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { minutesToLabel, statusToneAndLabel } from "./status-map";

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
 *
 * Usa `AppointmentRow` (hora compacta + avatar + nombre protagonista +
 * servicio + `StatusDot` chico) en vez de la `StatusPill` gigante que
 * tapaba el nombre y el servicio -- ese es el bug reportado.
 */
export function SimpleAgendaList({
  tenantSlug,
  dateISO,
  appointments,
}: {
  tenantSlug: string;
  dateISO: string;
  appointments: Appointment[];
}) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="event_available" />}
        title="Sin turnos este día"
        description="Todavía no hay nada agendado -- agendá el primero."
        action={
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={buttonVariants({ size: "default" })}
          >
            <Icon name="add" className="text-[18px]" />
            Agendar turno
          </Link>
        }
      />
    );
  }

  const sorted = [...appointments].sort((a, b) => a.startMinute - b.startMinute);

  return (
    <div className="space-y-2">
      {sorted.map((a) => {
        const { tone, label } = statusToneAndLabel(a.status);
        return (
          <AppointmentRow
            key={a.id}
            href={`/app/${tenantSlug}/agenda/${a.id}`}
            time={minutesToLabel(a.startMinute)}
            durationLabel={`${a.endMinute - a.startMinute} min`}
            clientName={a.clientName || "Sin nombre"}
            serviceName={a.serviceNames || "Sin servicio"}
            statusTone={tone}
            statusLabel={label}
            price={`$${a.total.toLocaleString("es-AR")}`}
          />
        );
      })}
    </div>
  );
}
