"use client";

import { useActionState, useState } from "react";
import { updateStaffSchedule, type ScheduleActionState } from "./schedule-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const WEEKDAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

type DayState = { weekday: number; active: boolean; starts_at: string; ends_at: string };

const initialState: ScheduleActionState = { error: null };

export function EditScheduleForm({
  tenantSlug,
  staffId,
  initialSchedule,
}: {
  tenantSlug: string;
  staffId: string;
  initialSchedule: { weekday: number; starts_at: string; ends_at: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    updateStaffSchedule.bind(null, tenantSlug, staffId),
    initialState,
  );

  const [days, setDays] = useState<DayState[]>(() =>
    WEEKDAYS.map((w) => {
      const existing = initialSchedule.find((s) => s.weekday === w.id);
      return {
        weekday: w.id,
        active: !!existing,
        starts_at: existing?.starts_at.slice(0, 5) ?? "09:00",
        ends_at: existing?.ends_at.slice(0, 5) ?? "18:00",
      };
    }),
  );

  function updateDay(weekday: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  const activeDaysPayload = days
    .filter((d) => d.active)
    .map(({ weekday, starts_at, ends_at }) => ({ weekday, starts_at, ends_at }));

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="days" value={JSON.stringify(activeDaysPayload)} />
      {WEEKDAYS.map((w) => {
        const day = days.find((d) => d.weekday === w.id)!;
        return (
          <div key={w.id} className="flex items-center gap-2">
            <label className="flex w-16 items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
              <input
                type="checkbox"
                checked={day.active}
                onChange={(e) => updateDay(w.id, { active: e.target.checked })}
              />
              {w.label}
            </label>
            {day.active ? (
              <>
                <Input
                  type="time"
                  value={day.starts_at}
                  onChange={(e) => updateDay(w.id, { starts_at: e.target.value })}
                  className="h-8 w-28"
                />
                <span className="text-on-surface-variant">–</span>
                <Input
                  type="time"
                  value={day.ends_at}
                  onChange={(e) => updateDay(w.id, { ends_at: e.target.value })}
                  className="h-8 w-28"
                />
              </>
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant">Cerrado</span>
            )}
          </div>
        );
      })}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar horario"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
