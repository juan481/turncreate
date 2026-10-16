import Link from "next/link";
import { cn } from "@/lib/utils";
import { longDayLabel } from "@/lib/dates";
import { Icon } from "@/components/ui/icon";
import type { MonthData } from "@/server/agenda-month";

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthGrid({
  tenantSlug,
  month,
  todayISO,
  selectedISO,
}: {
  tenantSlug: string;
  month: MonthData;
  todayISO: string;
  /** Día del que se vino a este calendario (el `?date=` de la vista Día). */
  selectedISO: string;
}) {
  const headingId = `mes-${month.monthISO}`;
  return (
    // La sección entera es el "contenedor" del título sticky: el rótulo
    // queda pegado arriba solo mientras ESTE mes está en pantalla, y el del
    // mes siguiente lo empuja al llegar -- nunca hay dos rótulos ni uno
    // desfasado (ver el comentario de InfiniteMonthScroller).
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="pointer-events-none sticky top-[calc(4rem+var(--safe-t))] z-10 flex justify-center lg:top-[6.25rem]">
        <h2
          id={headingId}
          className="pointer-events-auto flex min-w-0 max-w-full items-center gap-2 rounded-pill border border-border bg-surface-container-lowest/95 px-4 py-2 shadow-card backdrop-blur-xl"
        >
          <Icon name="event" className="text-[16px] text-secondary" />
          <span className="min-w-0 truncate font-label-lg text-label-lg text-on-surface">{month.label}</span>
          <span className="shrink-0 rounded-pill bg-secondary-soft px-2.5 py-0.5 font-label-sm text-label-sm tabular-nums text-secondary">
            {month.totalCount} turno{month.totalCount === 1 ? "" : "s"}
          </span>
        </h2>
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-surface text-on-surface shadow-card">
        <div className="grid grid-cols-7 border-b border-border bg-surface-container-low" aria-hidden>
          {WEEK_DAYS.map((day) => (
            <div key={day} className="min-w-0 px-0.5 py-3 text-center font-label-md text-label-md text-on-surface-variant">
              <span className="sm:hidden">{day.slice(0, 1)}</span>
              <span className="hidden sm:inline">{day}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[88px] sm:auto-rows-[110px]">
          {month.days.map((day, dayIdx) => {
            const isToday = day.dateISO === todayISO;
            // Seleccionado (sólido violeta) gana sobre "hoy" (anillo
            // violeta) cuando son el mismo día -- mismo criterio que el
            // dial de días de la vista Día.
            const isSelected = day.dateISO === selectedISO;
            return (
              <Link
                key={day.dateISO}
                href={`/app/${tenantSlug}/agenda?date=${day.dateISO}`}
                aria-label={`${longDayLabel(day.dateISO)}${day.count > 0 ? `, ${day.count} turno${day.count === 1 ? "" : "s"}` : ""}`}
                aria-current={isSelected ? "date" : undefined}
                className={cn(
                  "group flex min-w-0 flex-col border-b border-r border-border p-1.5 transition-colors hover:bg-secondary-soft focus:outline-none focus-visible:bg-secondary-soft sm:p-2",
                  !day.inCurrentMonth && "bg-surface-container-low opacity-50",
                  dayIdx % 7 === 6 && "border-r-0",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full font-body-sm text-body-sm font-semibold tabular-nums transition-colors",
                    isSelected
                      ? "bg-primary text-on-primary"
                      : isToday
                        ? "border-2 border-primary text-primary"
                        : "text-on-surface group-hover:bg-surface-container-low",
                  )}
                >
                  {Number(day.dateISO.slice(8, 10))}
                </span>

                {day.count > 0 && (
                  <div className="mt-auto min-w-0">
                    <span className="flex w-full min-w-0 items-center justify-center rounded-inner bg-secondary-soft p-1 font-label-sm text-label-sm tabular-nums text-secondary transition-colors group-hover:bg-surface-container-lowest">
                      <span className="truncate">
                        {day.count}
                        <span className="hidden sm:inline"> turno{day.count !== 1 && "s"}</span>
                      </span>
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
