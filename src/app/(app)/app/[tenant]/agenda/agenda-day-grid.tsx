"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { AppointmentRow } from "@/components/ui/appointment-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { moveAppointment } from "./move-appointment-action";
import { minutesToLabel, statusToneAndLabel } from "./status-map";

const PX_PER_MINUTE = 1.5;
const HEADER_HEIGHT = 68;

const STATUS_DOT: Record<string, string> = {
  pending_payment: "bg-status-pending-dot",
  confirmed: "bg-status-confirmed-dot",
  completed: "bg-status-confirmed-dot",
  no_show: "bg-status-alert-dot",
};

type Appointment = {
  id: string;
  staffId: string;
  startMinute: number;
  endMinute: number;
  status: string;
  clientName: string;
  serviceNames: string;
  total: number;
  balance: number;
};

type Staff = {
  id: string;
  displayName: string;
  color: string | null;
  photoUrl: string | null;
  specialty: string | null;
};

function DraggableAppointment({
  appointment,
  tenantSlug,
  dayStartMinute,
}: {
  appointment: Appointment;
  tenantSlug: string;
  dayStartMinute: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
  });

  const top = (appointment.startMinute - dayStartMinute) * PX_PER_MINUTE;
  const height = Math.max((appointment.endMinute - appointment.startMinute) * PX_PER_MINUTE, 34);
  const paid = appointment.balance <= 0;
  const compact = height < 70;

  return (
    <Link
      ref={setNodeRef}
      href={`/app/${tenantSlug}/agenda/${appointment.id}`}
      style={{
        top,
        height,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        zIndex: isDragging ? 20 : 1,
      }}
      className={cn(
        // Sin touch-none: esto es solo lg+ (desktop/tablet ancho, ver
        // AgendaDayGrid más abajo), así que ya no compite con el scroll
        // táctil vertical de la página en mobile.
        "group absolute left-1 right-1 block overflow-hidden rounded-inner bg-surface-container-low p-2 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
        isDragging && "opacity-70 shadow-card-hover",
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-pill bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-on-surface">
          {minutesToLabel(appointment.startMinute)}
        </span>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_DOT[appointment.status])} />
      </div>
      <p className="mt-1 truncate font-label-md text-label-md font-semibold text-on-surface">
        {appointment.clientName}
      </p>
      {!compact && (
        <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
          {appointment.serviceNames}
        </p>
      )}
      {!compact && (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-label-sm text-label-sm font-bold text-on-surface">
            ${appointment.total.toLocaleString("es-AR")}
          </span>
          <span
            className={cn(
              "rounded-pill px-2 py-0.5 font-label-sm text-label-sm",
              paid ? "bg-status-confirmed-bg text-status-confirmed" : "bg-surface-container-highest text-on-surface-variant",
            )}
          >
            {paid ? "Pagado" : "Seña"}
          </span>
        </div>
      )}
    </Link>
  );
}

function StaffColumn({
  staff,
  appointments,
  tenantSlug,
  dayStartMinute,
  totalHeight,
}: {
  staff: Staff;
  appointments: Appointment[];
  tenantSlug: string;
  dayStartMinute: number;
  totalHeight: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: staff.id });

  return (
    // Esta grilla ya solo se muestra desde lg+ (ver AgendaDayGrid): un
    // ancho fijo único alcanza, no hace falta la variante angosta que
    // existía para mobile.
    <div className="w-60 shrink-0 border-l border-border">
      <div
        className="flex items-center gap-2 border-b border-border px-2"
        style={{ height: HEADER_HEIGHT }}
      >
        <Avatar name={staff.displayName} src={staff.photoUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-label-md text-label-md font-semibold text-on-surface">
            {staff.displayName}
          </p>
          <span className="flex min-w-0 items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: staff.color ?? "var(--color-on-surface-variant)" }} />
            <span className="truncate">
              {staff.specialty ? `${staff.specialty} · ` : ""}
              {appointments.length} turno{appointments.length === 1 ? "" : "s"}
            </span>
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn("relative transition-colors", isOver && "bg-secondary-soft")}
        style={{ height: totalHeight }}
      >
        {appointments.map((appointment) => (
          <DraggableAppointment
            key={appointment.id}
            appointment={appointment}
            tenantSlug={tenantSlug}
            dayStartMinute={dayStartMinute}
          />
        ))}
      </div>
    </div>
  );
}

/** Grilla por columnas con drag & drop -- solo desktop/tablet ancho (lg+). */
function DesktopStaffGrid({
  tenantSlug,
  dateISO,
  dayStartMinute,
  dayEndMinute,
  slotIntervalMin,
  staff,
  appointments,
  nowMinute,
}: {
  tenantSlug: string;
  dateISO: string;
  dayStartMinute: number;
  dayEndMinute: number;
  slotIntervalMin: number;
  staff: Staff[];
  appointments: Appointment[];
  nowMinute?: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sin esto, cualquier click intercepta el evento de arrastre y rompe
  // la navegación normal del Link -- hace falta moverse 8px para que
  // dnd-kit considere que es un drag y no un click.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const totalHeight = (dayEndMinute - dayStartMinute) * PX_PER_MINUTE;
  const appointmentsByStaff = new Map<string, Appointment[]>();
  for (const appointment of appointments) {
    const list = appointmentsByStaff.get(appointment.staffId) ?? [];
    list.push(appointment);
    appointmentsByStaff.set(appointment.staffId, list);
  }

  const hourMarks: number[] = [];
  for (let m = Math.ceil(dayStartMinute / 60) * 60; m <= dayEndMinute; m += 60) {
    hourMarks.push(m);
  }

  function handleDragEnd(event: DragEndEvent) {
    const appointment = appointments.find((a) => a.id === event.active.id);
    if (!appointment) return;

    const deltaMinutesRaw = event.delta.y / PX_PER_MINUTE;
    const roundedDelta = Math.round(deltaMinutesRaw / slotIntervalMin) * slotIntervalMin;
    const duration = appointment.endMinute - appointment.startMinute;
    const newStartMinute = Math.max(
      dayStartMinute,
      Math.min(appointment.startMinute + roundedDelta, dayEndMinute - duration),
    );

    const newStaffId = (event.over?.id as string | undefined) ?? appointment.staffId;

    if (newStartMinute === appointment.startMinute && newStaffId === appointment.staffId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await moveAppointment(tenantSlug, {
        appointmentId: appointment.id,
        newStaffId,
        newStartMinute,
        dateISO,
      });
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-2">
      {error && <p className="font-body-sm text-body-sm text-status-alert">{error}</p>}
      {pending && (
        <p className="font-body-sm text-body-sm text-on-surface-variant">Moviendo turno…</p>
      )}
      {/* id fijo: sin esto dnd-kit genera aria-describedby con un contador
          global que no coincide entre el render de servidor y el del
          cliente (hydration mismatch), aunque no afecta al drag en sí. */}
      <DndContext id="agenda-day-grid" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-card border border-border bg-surface-container-lowest p-lg shadow-card">
          <div className="relative flex" style={{ width: "max-content" }}>
            {nowMinute != null && nowMinute >= dayStartMinute && nowMinute <= dayEndMinute && (
              <div
                className="pointer-events-none absolute left-14 right-0 z-10 flex items-center gap-2"
                style={{ top: HEADER_HEIGHT + (nowMinute - dayStartMinute) * PX_PER_MINUTE }}
              >
                <span className="rounded-pill bg-surface-container-high px-2.5 py-0.5 font-label-sm text-label-sm font-semibold text-secondary">
                  {minutesToLabel(nowMinute)} hs · En curso
                </span>
                <div className="h-0.5 flex-1 rounded-full bg-secondary/40" />
              </div>
            )}
            <div className="w-14 shrink-0 border-r border-border">
              <div className="border-b border-border" style={{ height: HEADER_HEIGHT }} />
              {hourMarks.map((minute) => (
                <div
                  key={minute}
                  className="relative"
                  style={{ height: 60 * PX_PER_MINUTE }}
                >
                  <span className="absolute -top-2 right-2 font-label-sm text-label-sm text-on-surface-variant">
                    {minutesToLabel(minute)}
                  </span>
                </div>
              ))}
            </div>
            {staff.map((s) => (
              <StaffColumn
                key={s.id}
                staff={s}
                appointments={appointmentsByStaff.get(s.id) ?? []}
                tenantSlug={tenantSlug}
                dayStartMinute={dayStartMinute}
                totalHeight={totalHeight}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}

/**
 * Lista + chips de filtro por profesional -- reemplazo mobile de la
 * grilla por columnas. La grilla fuerza scroll lateral con columnas de
 * ancho fijo (lo que el dueño describe como "no se entiende el
 * calendario"); en mobile no hay espacio para columnas, así que en vez
 * de eso se elige UN profesional (o "Todos") con chips, arriba de una
 * lista vertical de `AppointmentRow` -- la misma tarjeta que usa el
 * local de 1 sola persona, para que ambos casos se vean iguales.
 */
function TeamDayMobileList({
  tenantSlug,
  dateISO,
  staff,
  appointments,
}: {
  tenantSlug: string;
  dateISO: string;
  staff: Staff[];
  appointments: Appointment[];
}) {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const countByStaff = new Map<string, number>();
  for (const a of appointments) {
    countByStaff.set(a.staffId, (countByStaff.get(a.staffId) ?? 0) + 1);
  }

  const filtered = selectedStaffId
    ? appointments.filter((a) => a.staffId === selectedStaffId)
    : appointments;
  const sorted = [...filtered].sort((a, b) => a.startMinute - b.startMinute);
  const staffNameById = new Map(staff.map((s) => [s.id, s.displayName]));

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => setSelectedStaffId(null)}
          className={cn(
            "flex h-11 shrink-0 items-center rounded-pill px-4 font-label-sm text-label-sm transition-colors",
            selectedStaffId === null
              ? "bg-primary text-on-primary"
              : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
          )}
        >
          Todos ({appointments.length})
        </button>
        {staff.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedStaffId(s.id)}
            className={cn(
              "flex h-11 shrink-0 items-center gap-1.5 rounded-pill px-4 font-label-sm text-label-sm transition-colors",
              selectedStaffId === s.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: selectedStaffId === s.id ? "var(--color-surface)" : s.color ?? "var(--color-on-surface-variant)" }}
            />
            <span className="max-w-[9rem] truncate">{s.displayName}</span>
            <span className="tabular-nums">({countByStaff.get(s.id) ?? 0})</span>
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Icon name="event_available" />}
          title="Sin turnos este día"
          description="Todavía no hay nada agendado para esta selección."
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
      ) : (
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
                staffName={selectedStaffId ? undefined : staffNameById.get(a.staffId)}
                statusTone={tone}
                statusLabel={label}
                price={`$${a.total.toLocaleString("es-AR")}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Local de equipo (más de 1 profesional). Compone las dos variantes de
 * arriba y las intercambia por CSS (`hidden`/`lg:hidden`), no por JS: las
 * dos reciben los mismos datos ya cargados por el Server Component
 * padre, así no hace falta duplicar la consulta a Firestore.
 */
export function AgendaDayGrid({
  tenantSlug,
  dateISO,
  dayStartMinute,
  dayEndMinute,
  slotIntervalMin,
  staff,
  appointments,
  nowMinute,
}: {
  tenantSlug: string;
  dateISO: string;
  dayStartMinute: number;
  dayEndMinute: number;
  slotIntervalMin: number;
  staff: Staff[];
  appointments: Appointment[];
  nowMinute?: number | null;
}) {
  return (
    <div>
      <div className="lg:hidden">
        <TeamDayMobileList tenantSlug={tenantSlug} dateISO={dateISO} staff={staff} appointments={appointments} />
      </div>
      <div className="hidden lg:block">
        <DesktopStaffGrid
          tenantSlug={tenantSlug}
          dateISO={dateISO}
          dayStartMinute={dayStartMinute}
          dayEndMinute={dayEndMinute}
          slotIntervalMin={slotIntervalMin}
          staff={staff}
          appointments={appointments}
          nowMinute={nowMinute}
        />
      </div>
    </div>
  );
}
