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
import { cn } from "@/lib/utils";
import { moveAppointment } from "./move-appointment-action";

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

function minutesToLabel(minute: number) {
  const h = Math.floor(minute / 60).toString().padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

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
        "group absolute left-1 right-1 block touch-none overflow-hidden rounded-inner bg-surface-container-low p-2 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover",
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
    // 240px por columna deja ver una y media en un celular; a 160 entran
    // dos completas y el scroll horizontal sigue disponible para el resto.
    <div className="w-40 shrink-0 border-l border-border sm:w-60">
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
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: staff.color ?? "#767582" }} />
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
