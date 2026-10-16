"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addMonthsISO } from "@/lib/dates";
import { Icon } from "@/components/ui/icon";
import type { MonthData } from "@/server/agenda-month";
import { loadMonth } from "./actions";
import { MonthGrid } from "./month-grid";

/**
 * Lista infinita de meses hacia adelante.
 *
 * El rótulo del mes ya NO es un pill global sticky alimentado por un
 * IntersectionObserver: ese observer solo miraba las entradas que acababan
 * de cambiar en cada callback (no todas las secciones visibles), así que
 * mientras se scrolleaba quedaba mostrando el mes equivocado -- y encima
 * cada MonthGrid pintaba su propio título, con lo que se veían dos meses a
 * la vez. Ahora el título de CADA mes es sticky dentro de su propia
 * sección (ver MonthGrid): el navegador lo deja pegado arriba mientras su
 * mes está en pantalla y el del mes siguiente lo empuja al llegar. Un solo
 * rótulo visible, siempre el correcto, sin JS de por medio.
 */
export function InfiniteMonthScroller({
  tenantSlug,
  initialMonth,
  todayISO,
  selectedISO,
}: {
  tenantSlug: string;
  initialMonth: MonthData;
  todayISO: string;
  selectedISO: string;
}) {
  const [months, setMonths] = useState<MonthData[]>([initialMonth]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const monthsRef = useRef(months);
  const loadingRef = useRef(false);
  useEffect(() => {
    monthsRef.current = months;
  }, [months]);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadNext = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    const last = monthsRef.current[monthsRef.current.length - 1];
    const nextMonthISO = addMonthsISO(last.monthISO, 1);
    try {
      const data = await loadMonth(tenantSlug, nextMonthISO);
      setMonths((prev) => (prev.some((m) => m.monthISO === data.monthISO) ? prev : [...prev, data]));
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadNext();
      },
      { rootMargin: "800px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // months.length: re-observar después de cada carga hace que, si el
    // sentinel sigue dentro del margen (pantallas altas), se pida el
    // siguiente mes sin esperar a que el usuario scrollee.
  }, [loadNext, months.length, error]);

  return (
    <div className="space-y-xl">
      {months.map((month) => (
        <MonthGrid
          key={month.monthISO}
          tenantSlug={tenantSlug}
          month={month}
          todayISO={todayISO}
          selectedISO={selectedISO}
        />
      ))}

      <div ref={sentinelRef} className="h-4" />
      {loading && (
        <p className="flex items-center justify-center gap-2 py-4 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-[16px]" />
          Cargando el próximo mes…
        </p>
      )}
      {error && !loading && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={() => loadNext()}
            className="flex min-h-11 items-center gap-1.5 rounded-pill bg-surface-container-low px-4 py-2 text-center font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Icon name="autorenew" className="text-[16px]" />
            No se pudo cargar el próximo mes. Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
