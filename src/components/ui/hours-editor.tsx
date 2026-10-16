"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { Input } from "./input";
import {
  addSplitBlock,
  copyDayToOpenDays,
  dayError,
  MAX_BLOCKS_PER_DAY,
  removeSplitBlock,
  setDayActive,
  updateBlock,
  WEEKDAY_LABELS,
  type DayHours,
  type HourBlock,
} from "./hours-editor-model";

export type { DayHours, HourBlock } from "./hours-editor-model";

/**
 * Editor de horarios de la semana: un día por tarjeta, switch abierto/cerrado,
 * hasta dos franjas (horario partido) y "Copiar a todos". Controlado: el padre
 * guarda `value` y decide cuándo se puede enviar (ver weekError en el modelo).
 */
export function HoursEditor({
  value,
  onChange,
  className,
}: {
  value: DayHours[];
  onChange: (next: DayHours[]) => void;
  className?: string;
}) {
  const [copiedWeekday, setCopiedWeekday] = useState<number | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openDays = value.filter((day) => day.active).length;

  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  function copyToOpenDays(weekday: number) {
    onChange(copyDayToOpenDays(value, weekday));
    setCopiedWeekday(weekday);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopiedWeekday(null), 1600);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.map((day) => (
        <DayCard
          key={day.weekday}
          day={day}
          canCopy={openDays > 1}
          copied={copiedWeekday === day.weekday}
          onToggle={(active) => onChange(setDayActive(value, day.weekday, active))}
          onBlockChange={(index, patch) => onChange(updateBlock(value, day.weekday, index, patch))}
          onAddSplit={() => onChange(addSplitBlock(value, day.weekday))}
          onRemoveSplit={() => onChange(removeSplitBlock(value, day.weekday))}
          onCopy={() => copyToOpenDays(day.weekday)}
        />
      ))}
    </div>
  );
}

function DayCard({
  day,
  canCopy,
  copied,
  onToggle,
  onBlockChange,
  onAddSplit,
  onRemoveSplit,
  onCopy,
}: {
  day: DayHours;
  canCopy: boolean;
  copied: boolean;
  onToggle: (active: boolean) => void;
  onBlockChange: (index: number, patch: Partial<HourBlock>) => void;
  onAddSplit: () => void;
  onRemoveSplit: () => void;
  onCopy: () => void;
}) {
  const labelId = useId();
  const label = WEEKDAY_LABELS[day.weekday]?.long ?? "Día";
  const error = dayError(day);

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn(
        "rounded-inner border px-3 py-2 transition-colors duration-200",
        day.active ? "border-border bg-surface" : "border-transparent bg-surface-container-low",
      )}
    >
      <div className="flex min-h-11 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span
            id={labelId}
            className={cn("truncate font-label-lg text-label-lg", day.active ? "text-on-surface" : "text-on-surface-variant")}
          >
            {label}
          </span>
          {!day.active && <span className="shrink-0 font-body-sm text-body-sm text-on-surface-variant">Cerrado</span>}
        </div>
        <Switch checked={day.active} onChange={onToggle} label={label} />
      </div>

      {day.active && (
        <div className="space-y-2 pb-1 pt-1">
          {day.blocks.map((block, index) => {
            const which = index === 0 ? label : `${label}, 2ª franja`;
            return (
              <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <TimeInput
                  aria-label={`${which}: abre`}
                  value={block.opens_at}
                  invalid={Boolean(error)}
                  onChange={(opens_at) => onBlockChange(index, { opens_at })}
                />
                <span aria-hidden className="font-body-md text-body-md text-on-surface-variant">a</span>
                <TimeInput
                  aria-label={`${which}: cierra`}
                  value={block.closes_at}
                  invalid={Boolean(error)}
                  onChange={(closes_at) => onBlockChange(index, { closes_at })}
                />
              </div>
            );
          })}

          {error && (
            <p role="alert" className="font-body-sm text-body-sm text-status-alert">
              {error}
            </p>
          )}

          <div className="-ml-1 flex flex-wrap items-center gap-x-3">
            {day.blocks.length < MAX_BLOCKS_PER_DAY ? (
              <TextAction icon="add" onClick={onAddSplit}>Horario partido</TextAction>
            ) : (
              <TextAction icon="close" onClick={onRemoveSplit}>Quitar horario partido</TextAction>
            )}
            {canCopy && (
              <TextAction
                icon={copied ? "check" : "event_available"}
                onClick={onCopy}
                title="Copiar este horario a todos los días abiertos"
                className={copied ? "text-status-confirmed" : undefined}
              >
                {copied ? "¡Copiado!" : "Copiar a todos"}
              </TextAction>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInput({
  value,
  onChange,
  invalid,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  "aria-label": string;
}) {
  return (
    <Input
      type="time"
      value={value}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      onChange={(event) => onChange(event.target.value)}
      // appearance-none + min-w-0: sin esto Safari iOS le da un ancho mínimo
      // propio al input de hora y la fila se sale de la tarjeta a 320px.
      className={cn(
        "min-w-0 appearance-none px-2 text-center tabular-nums [&::-webkit-date-and-time-value]:text-center",
        invalid && "ring-status-alert/40",
      )}
    />
  );
}

function TextAction({
  icon,
  children,
  onClick,
  title,
  className,
}: {
  icon: string;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-pill px-1 font-label-md text-label-md text-secondary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-secondary",
        className,
      )}
    >
      <Icon name={icon} className="text-[15px]" />
      {children}
    </button>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="-mr-1 flex h-11 w-14 shrink-0 items-center justify-center rounded-pill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 rounded-pill transition-colors duration-200",
          checked ? "bg-secondary" : "bg-surface-container-highest",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
