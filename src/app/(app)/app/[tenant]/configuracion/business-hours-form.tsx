"use client";

import { useActionState, useState } from "react";
import { updateBusinessHours, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const WEEKDAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" },
];

type Block = { opens_at: string; closes_at: string };
type DayState = { weekday: number; active: boolean; blocks: Block[] };

const initialState: ConfigActionState = { error: null };

export function BusinessHoursForm({
  tenantSlug,
  initialHours,
}: {
  tenantSlug: string;
  initialHours: { weekday: number; opens_at: string; closes_at: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessHours.bind(null, tenantSlug),
    initialState,
  );

  const [days, setDays] = useState<DayState[]>(() =>
    WEEKDAYS.map((w) => {
      const existing = initialHours.filter((h) => h.weekday === w.id);
      return {
        weekday: w.id,
        active: existing.length > 0,
        blocks:
          existing.length > 0
            ? existing.map((h) => ({ opens_at: h.opens_at.slice(0, 5), closes_at: h.closes_at.slice(0, 5) }))
            : [{ opens_at: "09:00", closes_at: "19:00" }],
      };
    }),
  );

  function toggleActive(weekday: number, active: boolean) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, active } : d)));
  }

  function updateBlock(weekday: number, index: number, patch: Partial<Block>) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, blocks: d.blocks.map((b, i) => (i === index ? { ...b, ...patch } : b)) }
          : d,
      ),
    );
  }

  function addBlock(weekday: number) {
    setDays((prev) =>
      prev.map((d) =>
        d.weekday === weekday ? { ...d, blocks: [...d.blocks, { opens_at: "17:00", closes_at: "21:00" }] } : d,
      ),
    );
  }

  function removeBlock(weekday: number, index: number) {
    setDays((prev) =>
      prev.map((d) => (d.weekday === weekday ? { ...d, blocks: d.blocks.filter((_, i) => i !== index) } : d)),
    );
  }

  const payload = days
    .filter((d) => d.active)
    .flatMap((d) => d.blocks.map((b) => ({ weekday: d.weekday, opens_at: b.opens_at, closes_at: b.closes_at })));

  return (
    <form action={formAction} className="space-y-1.5">
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />
      {days.map((day) => {
        const label = WEEKDAYS.find((w) => w.id === day.weekday)!.label;
        return (
          <div key={day.weekday} className="rounded-inner bg-surface-container-low px-2.5 py-2">
            <div className="flex items-center gap-2">
              <label className="flex w-14 shrink-0 items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={day.active}
                  onChange={(e) => toggleActive(day.weekday, e.target.checked)}
                />
                {label}
              </label>
              {!day.active && <span className="font-body-sm text-body-sm text-on-surface-variant">Cerrado</span>}
              {day.active && (
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {day.blocks.map((block, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Input
                        type="time"
                        value={block.opens_at}
                        onChange={(e) => updateBlock(day.weekday, i, { opens_at: e.target.value })}
                        className="h-8 w-[7.5rem] px-2 text-body-sm"
                      />
                      <span className="text-on-surface-variant">–</span>
                      <Input
                        type="time"
                        value={block.closes_at}
                        onChange={(e) => updateBlock(day.weekday, i, { closes_at: e.target.value })}
                        className="h-8 w-[7.5rem] px-2 text-body-sm"
                      />
                      {day.blocks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBlock(day.weekday, i)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-on-surface-variant hover:text-status-alert"
                          aria-label="Quitar franja"
                        >
                          <Icon name="close" className="text-[14px]" />
                        </button>
                      )}
                    </div>
                  ))}
                  {day.blocks.length < 2 && (
                    <button
                      type="button"
                      onClick={() => addBlock(day.weekday)}
                      className="flex items-center gap-0.5 font-label-sm text-label-sm text-secondary hover:text-secondary/80"
                      title="Agregar corte (horario partido)"
                    >
                      <Icon name="add" className="text-[14px]" />
                      Corte
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar horarios"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      {state.success && <p className="font-body-sm text-body-sm text-status-confirmed">Horarios actualizados.</p>}
    </form>
  );
}
