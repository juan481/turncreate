"use client";

import { useState } from "react";
import {
  addDaysISO,
  addMonthsISO,
  daysInMonth,
  longDayLabel,
  monthLabel,
  startOfMonthISO,
  startOfWeekISO,
} from "@/lib/dates";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const WEEK_DAYS = [
  { short: "L", long: "lunes" },
  { short: "M", long: "martes" },
  { short: "M", long: "miércoles" },
  { short: "J", long: "jueves" },
  { short: "V", long: "viernes" },
  { short: "S", long: "sábado" },
  { short: "D", long: "domingo" },
];

/**
 * Calendario mensual para elegir UN día (fechas calendario "YYYY-MM-DD",
 * sin zonas horarias: todo pasa por src/lib/dates.ts). Semana de lunes a
 * domingo, igual que la vista Mes de la agenda.
 *
 * - `minISO`/`maxISO` acotan el rango elegible (y hasta dónde se puede
 *   navegar de mes); `isDayDisabled` deshabilita días puntuales (p. ej.
 *   los días de la semana en que el local cierra).
 * - Cada día es un <button> con nombre accesible completo ("Martes 21 de
 *   octubre") y `data-date` con la fecha ISO, así se puede tocar/testear
 *   un día puntual sin depender del texto visible.
 * - `todayISO` viene del servidor (en la zona del local) para no depender
 *   del reloj/zona del navegador ni romper la hidratación.
 */
export function MonthCalendar({
  value,
  onChange,
  todayISO,
  minISO,
  maxISO,
  isDayDisabled,
  className,
}: {
  value: string | null;
  onChange: (dateISO: string) => void;
  todayISO: string;
  minISO?: string;
  maxISO?: string;
  isDayDisabled?: (dateISO: string) => boolean;
  className?: string;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonthISO(value ?? todayISO));
  // Si el valor cambia desde afuera a otro mes, el calendario lo sigue
  // (ajuste de estado durante el render, sin efecto).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value && startOfMonthISO(value) !== visibleMonth) setVisibleMonth(startOfMonthISO(value));
  }

  const canPrev = !minISO || visibleMonth > startOfMonthISO(minISO);
  const canNext = !maxISO || visibleMonth < startOfMonthISO(maxISO);

  const lastOfMonth = addDaysISO(visibleMonth, daysInMonth(visibleMonth) - 1);
  const gridStart = startOfWeekISO(visibleMonth);
  const gridEnd = addDaysISO(startOfWeekISO(lastOfMonth), 7);
  const cells: string[] = [];
  for (let iso = gridStart; iso < gridEnd; iso = addDaysISO(iso, 1)) cells.push(iso);
  const monthPrefix = visibleMonth.slice(0, 7);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setVisibleMonth(addMonthsISO(visibleMonth, -1))}
          disabled={!canPrev}
          aria-label="Mes anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="chevron_left" className="text-[20px]" />
        </button>
        <p aria-live="polite" className="min-w-0 truncate text-center font-label-lg text-label-lg text-on-surface">
          {monthLabel(visibleMonth)}
        </p>
        <button
          type="button"
          onClick={() => setVisibleMonth(addMonthsISO(visibleMonth, 1))}
          disabled={!canNext}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:pointer-events-none disabled:opacity-30"
        >
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>

      <div className="grid grid-cols-7" aria-hidden>
        {WEEK_DAYS.map((day) => (
          <span key={day.long} className="py-1 text-center font-label-sm text-label-sm text-on-surface-variant">
            {day.short}
          </span>
        ))}
      </div>

      <div role="group" aria-label={monthLabel(visibleMonth)} className="grid grid-cols-7 gap-y-1">
        {cells.map((iso) => {
          if (iso.slice(0, 7) !== monthPrefix) return <span key={iso} aria-hidden />;
          const disabled = (minISO !== undefined && iso < minISO) || (maxISO !== undefined && iso > maxISO) || Boolean(isDayDisabled?.(iso));
          const selected = iso === value && !disabled;
          const isToday = iso === todayISO;
          return (
            <div key={iso} className="flex min-w-0 justify-center">
              <button
                type="button"
                data-date={iso}
                disabled={disabled}
                aria-pressed={selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${longDayLabel(iso)}${isToday ? " (hoy)" : ""}`}
                onClick={() => onChange(iso)}
                className={cn(
                  "flex h-11 w-full max-w-11 items-center justify-center rounded-full font-label-lg text-label-lg tabular-nums transition-colors duration-150 motion-reduce:transition-none",
                  selected
                    ? "bg-primary text-on-primary shadow-card"
                    : isToday
                      ? "text-primary ring-2 ring-inset ring-primary/50 hover:bg-surface-container"
                      : "text-on-surface hover:bg-surface-container",
                  disabled && "pointer-events-none text-on-surface-variant/35 ring-0",
                )}
              >
                {Number(iso.slice(8, 10))}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
