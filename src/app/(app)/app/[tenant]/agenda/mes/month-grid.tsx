import Link from "next/link";
import { cn } from "@/lib/utils";
import type { MonthData } from "@/server/agenda-month";

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthGrid({
  tenantSlug,
  month,
  todayISO,
}: {
  tenantSlug: string;
  month: MonthData;
  todayISO: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="px-1 font-headline-sm text-headline-sm capitalize text-on-surface">{month.label}</h2>
      <div className="overflow-hidden rounded-card border border-border bg-surface text-on-surface shadow-card">
        <div className="grid grid-cols-7 border-b border-border bg-surface-container-low">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="p-3 text-center font-label-md text-label-md text-on-surface-variant">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[110px]">
          {month.days.map((day, dayIdx) => {
            const isToday = day.dateISO === todayISO;
            return (
              <Link
                key={day.dateISO}
                href={`/app/${tenantSlug}/agenda?date=${day.dateISO}`}
                className={cn(
                  "group flex flex-col border-b border-r border-border p-2 transition-colors hover:bg-secondary-soft focus:outline-none",
                  !day.inCurrentMonth && "bg-surface-container-low opacity-50",
                  dayIdx % 7 === 6 && "border-r-0",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full font-body-sm text-body-sm transition-colors",
                    isToday ? "bg-primary font-bold text-on-primary" : "text-on-surface group-hover:bg-surface-container-low",
                  )}
                >
                  {Number(day.dateISO.slice(8, 10))}
                </span>

                {day.count > 0 && (
                  <div className="mt-auto">
                    <span className="inline-flex w-full items-center justify-center rounded-inner bg-secondary-soft p-1 font-label-sm text-label-sm text-secondary transition-colors group-hover:bg-surface-container-lowest">
                      {day.count} turno{day.count !== 1 && "s"}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
