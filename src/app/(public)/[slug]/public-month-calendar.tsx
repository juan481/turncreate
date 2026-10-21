"use client";

import { TZDate } from "@date-fns/tz";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function PublicMonthCalendar({
  timezone,
  selectedDate,
  onSelect,
  minDate,
  maxDate,
  bookableWeekdays,
}: {
  timezone: string;
  selectedDate: string;
  onSelect: (dateISO: string) => void;
  minDate: string;
  maxDate: string;
  bookableWeekdays: number[];
}) {
  const today = new TZDate(new Date(), timezone);
  const months = [startOfMonth(today), startOfMonth(addMonths(today, 1))];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {months.map((month) => {
          const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
          const mondayOffset = (getDay(days[0]) + 6) % 7;
          return (
            <section key={format(month, "yyyy-MM")} className="rounded-inner border border-border bg-surface p-3" aria-label={format(month, "MMMM yyyy", { locale: es })}>
              <h2 className="mb-3 text-center font-label-lg text-label-lg capitalize text-on-surface">{format(month, "MMMM yyyy", { locale: es })}</h2>
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
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      aria-label={`${format(day, "EEEE d 'de' MMMM", { locale: es })}${noAttention ? ", sin atención" : ""}`}
                      aria-pressed={selected}
                      onClick={() => onSelect(iso)}
                      className={cn(
                        "aspect-square min-h-9 rounded-full font-label-md text-label-md tabular-nums transition-colors",
                        selected && "bg-primary text-on-primary shadow-card",
                        !selected && !disabled && "text-on-surface hover:bg-secondary-soft hover:text-secondary",
                        disabled && "cursor-not-allowed bg-surface-container-low text-on-surface-variant/45",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <p className="flex items-center gap-2 px-1 font-body-sm text-body-sm text-on-surface-variant">
        <span className="size-3 rounded-full bg-surface-container-high" aria-hidden />
        Los días en gris no tienen atención disponible.
      </p>
    </div>
  );
}
