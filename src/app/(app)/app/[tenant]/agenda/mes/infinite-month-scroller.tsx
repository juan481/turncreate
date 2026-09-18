"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addMonths, format } from "date-fns";
import { Icon } from "@/components/ui/icon";
import type { MonthData } from "@/server/agenda-month";
import { loadMonth } from "./actions";
import { MonthGrid } from "./month-grid";

export function InfiniteMonthScroller({
  tenantSlug,
  initialMonth,
  todayISO,
}: {
  tenantSlug: string;
  initialMonth: MonthData;
  todayISO: string;
}) {
  const [months, setMonths] = useState<MonthData[]>([initialMonth]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const monthsRef = useRef(months);
  const loadingRef = useRef(loading);
  useEffect(() => {
    monthsRef.current = months;
    loadingRef.current = loading;
  }, [months, loading]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const loadNext = useCallback(async () => {
    if (loadingRef.current) return;
    setLoading(true);
    const last = monthsRef.current[monthsRef.current.length - 1];
    const nextMonthDate = addMonths(new Date(`${last.monthISO}T12:00:00`), 1);
    const nextMonthISO = format(nextMonthDate, "yyyy-MM-dd");
    try {
      const data = await loadMonth(tenantSlug, nextMonthISO);
      setMonths((prev) => [...prev, data]);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNext();
      },
      { rootMargin: "800px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNext]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx: number | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          const idx = Number((entry.target as HTMLElement).dataset.index);
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestIdx !== null) setActiveIndex(bestIdx);
      },
      { threshold: [0.15, 0.3, 0.5, 0.75] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [months.length]);

  const activeMonth = months[activeIndex] ?? months[0];

  return (
    <div className="space-y-xl">
      <div className="sticky top-[4.75rem] z-10 flex justify-center md:top-[5.25rem]">
        <div className="flex items-center gap-2 rounded-pill border border-border bg-surface-container-lowest/95 px-4 py-2 shadow-card backdrop-blur-xl">
          <Icon name="event" className="text-[16px] text-secondary" />
          <span className="font-label-md text-label-md capitalize text-on-surface">{activeMonth.label}</span>
          <span className="rounded-pill bg-secondary-soft px-2.5 py-0.5 font-label-sm text-label-sm text-secondary">
            {activeMonth.totalCount} turno{activeMonth.totalCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {months.map((month, idx) => (
        <div
          key={month.monthISO}
          ref={(el) => {
            if (el) sectionRefs.current.set(idx, el);
            else sectionRefs.current.delete(idx);
          }}
          data-index={idx}
        >
          <MonthGrid tenantSlug={tenantSlug} month={month} todayISO={todayISO} />
        </div>
      ))}

      <div ref={sentinelRef} className="h-4" />
      {loading && (
        <p className="flex items-center justify-center gap-2 py-4 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="progress_activity" className="animate-spin text-[16px]" />
          Cargando el próximo mes…
        </p>
      )}
    </div>
  );
}
