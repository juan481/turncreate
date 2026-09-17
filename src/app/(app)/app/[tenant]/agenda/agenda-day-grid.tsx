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
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { moveAppointment } from "./move-appointment-action";

const PX_PER_MINUTE = 1.5;
const HEADER_HEIGHT = 44;

const STATUS_LABEL: Record<string, { label: string; pill: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente", pill: "pending" },
  confirmed: { label: "Confirmado", pill: "confirmed" },
  completed: { label: "Completado", pill: "confirmed" },
  no_show: { label: "No vino", pill: "alert" },
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
};

type Staff = { id: string; displayName: string; color: string | null };

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

  const status = STATUS_LABEL[appointment.status] ?? {
    label: appointment.status,
    pill: "pending" as StatusPillStatus,
  };
  const top = (appointment.startMinute - dayStartMinute) * PX_PER_MINUTE;
  const height = Math.max((appointment.endMinute - appointment.startMinute) * PX_PER_MINUTE, 34);

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
      className={`absolute left-1 right-1 block touch-none overflow-hidden rounded-inner bg-surface-muted p-1.5 shadow-card transition-shadow hover:shadow-card-hover ${
        isDragging ? "opacity-70 shadow-card-hover" : ""
      }`}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-label-sm text-label-sm text-on-surface">
          {minutesToLabel(appointment.startMinute)}
        </span>
        <StatusPill status={status.pill} className="shrink-0">
          {status.label}
        </StatusPill>
      </div>
      <p className="truncate font-body-sm text-body-sm text-on-surface">
        {appointment.clientName}
      </p>
      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
        {appointment.serviceNames}
      </p>
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
    <div className="w-56 shrink-0 border-l border-border">
      <div
        className="flex items-center gap-2 border-b border-border px-2"
        style={{ height: HEADER_HEIGHT }}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: staff.color ?? "#767582" }}
        />
        <span className="truncate font-label-md text-label-md text-on-surface">
          {staff.displayName}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`relative transition-colors ${isOver ? "bg-secondary-soft" : ""}`}
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
}: {
  tenantSlug: string;
  dateISO: string;
  dayStartMinute: number;
  dayEndMinute: number;
  slotIntervalMin: number;
  staff: Staff[];
  appointments: Appointment[];
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
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-card">
          <div className="flex" style={{ width: "max-content" }}>
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
