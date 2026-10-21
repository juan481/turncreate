"use client";

import { useState } from "react";
import { TZDate } from "@date-fns/tz";
import { eachDayOfInterval, endOfMonth, format, getDay, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function PublicMonthCalendar({ timezone, selectedDate, onSelect, minDate, maxDate, bookableWeekdays }: {
  timezone: string;
  selectedDate: string;
  onSelect: (dateISO: string) => void;
  minDate: string;
  maxDate: string;
  bookableWeekdays: number[];
}) {
  const today = new TZDate(new Date(), timezone);
  const currentMonth = new TZDate(today.getFullYear(), today.getMonth(), 1, timezone);
  const nextMonth = new TZDate(today.getFullYear(), today.getMonth() + 1, 1, timezone);
  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const days = eachDayOfInterval({ start: startOfMonth(visibleMonth), end: endOfMonth(visibleMonth) });
  const mondayOffset = (getDay(days[0]) + 6) % 7;
  const showingCurrent = isSameMonth(visibleMonth, currentMonth);
  const showingNext = isSameMonth(visibleMonth, nextMonth);
  const canShowNext = format(nextMonth, "yyyy-MM-dd") <= maxDate;

  return (
    <div className="space-y-3">
      <section className="rounded-card border border-border bg-surface p-3 shadow-card" aria-label={format(visibleMonth, "MMMM yyyy", { locale: es })}>
        <div className="mb-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
          <button type="button" disabled={showingCurrent} onClick={() => setVisibleMonth(currentMonth)} className="grid size-11 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-secondary-soft hover:text-secondary disabled:cursor-not-allowed disabled:opacity-25" aria-label="Ver mes actual">
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <h2 className="text-center font-label-lg text-label-lg capitalize text-on-surface">{format(visibleMonth, "MMMM yyyy", { locale: es })}</h2>
          <button type="button" disabled={showingNext || !canShowNext} onClick={() => setVisibleMonth(nextMonth)} className="grid size-11 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-secondary-soft hover:text-secondary disabled:cursor-not-allowed disabled:opacity-25" aria-label="Ver mes siguiente">
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1" aria-hidden>
          {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`} className="py-1 text-center font-label-xs text-label-xs text-on-surface-variant">{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: mondayOffset }, (_, index) => <span key={`blank-${index}`} />)}
          {days.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const outsideRange = iso < minDate || iso > maxDate;
            const noAttention = !bookableWeekdays.includes(getDay(day));
            const disabled = outsideRange || noAttention;
            const selected = iso === selectedDate;
            return (
              <button key={iso} type="button" disabled={disabled} aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${noAttention ? ", sin atención" : ""}`} aria-pressed={selected} onClick={() => onSelect(iso)} className={cn(
                "aspect-square min-h-10 rounded-full font-label-md text-label-md tabular-nums transition-all duration-200",
                selected && "bg-primary text-on-primary shadow-brand",
                !selected && !disabled && "text-on-surface hover:-translate-y-0.5 hover:bg-secondary-soft hover:text-secondary",
                disabled && "cursor-not-allowed bg-surface-container-low text-on-surface-variant/45",
              )}>{format(day, "d")}</button>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 font-body-sm text-body-sm text-on-surface-variant">
        <p className="flex items-center gap-2"><span className="size-3 rounded-full bg-surface-container-high" aria-hidden />Sin atención</p>
        <p className="flex items-center gap-1 text-secondary"><Icon name="ads_click" className="text-[15px]" />Al elegir el día, ves los horarios.</p>
      </div>
    </div>
  );
}
