"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { longDayLabel, shortWeekdayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type DayDialItem = {
  dateISO: string;
  href: string;
  /** Cantidad de turnos del día (opcional: sin dato no se muestra nada). */
  count?: number;
};

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Tira horizontal de días tipo "dial": fila con scroll-snap e inercia
 * nativa, el día elegido queda centrado y resaltado, hoy lleva un anillo.
 * Tocar un día navega (es un <Link>, igual que "Hoy").
 *
 * - No desborda la página: el scroll es del propio contenedor (min-w-0 +
 *   overflow-x-auto), y el padding lateral de 50% deja centrar hasta el
 *   primer y el último día.
 * - Al montar se centra el día elegido sin animación; si cambia el día
 *   elegido se desliza suave (salvo movimiento reducido).
 * - `prefetch={false}`: con ~120 días, prefetchear cada uno que pasa por
 *   pantalla al deslizar sería una ráfaga de renders dinámicos al pedo.
 */
export function DayDial({
  items,
  selectedISO,
  todayISO,
  label = "Elegir día",
  className,
}: {
  items: DayDialItem[];
  selectedISO: string;
  todayISO: string;
  label?: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = scroller.querySelector<HTMLElement>(`[data-date="${selectedISO}"]`);
    if (!target) return;
    const left = target.offsetLeft - (scroller.clientWidth - target.offsetWidth) / 2;
    const smooth = didMountRef.current && !prefersReducedMotion();
    scroller.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
    didMountRef.current = true;
  }, [selectedISO]);

  return (
    <nav aria-label={label} className={cn("relative min-w-0", className)}>
      <div
        ref={scrollerRef}
        className="relative flex min-w-0 snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain px-[calc(50%-1.5rem)] py-1 [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]"
      >
        {items.map((item) => {
          const isSelected = item.dateISO === selectedISO;
          const isToday = item.dateISO === todayISO;
          const count = item.count ?? 0;
          const firstOfMonth = item.dateISO.endsWith("-01");
          return (
            <Link
              key={item.dateISO}
              href={item.href}
              prefetch={false}
              data-date={item.dateISO}
              aria-current={isSelected ? "date" : undefined}
              aria-label={`${longDayLabel(item.dateISO)}${isToday ? " (hoy)" : ""}${count > 0 ? `, ${count} turno${count === 1 ? "" : "s"}` : ""}`}
              className={cn(
                "relative flex h-16 w-12 shrink-0 snap-center flex-col items-center justify-center gap-0.5 rounded-inner transition-colors duration-200 motion-reduce:transition-none",
                isSelected
                  ? "bg-primary text-on-primary shadow-card-hover"
                  : isToday
                    ? "bg-surface-container-lowest text-primary ring-2 ring-inset ring-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <span className={cn("font-label-xs text-label-xs uppercase", firstOfMonth && !isSelected && "text-primary")}>
                {shortWeekdayLabel(item.dateISO)}
              </span>
              <span className="font-label-lg text-label-lg font-semibold tabular-nums">{Number(item.dateISO.slice(8, 10))}</span>
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  count > 0 ? (isSelected ? "bg-on-primary" : "bg-primary") : "bg-transparent",
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
