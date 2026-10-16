import { cn } from "@/lib/utils";

/*
 * Esqueletos de Reportes: misma grilla y alturas aproximadas que las
 * secciones reales (sections.tsx) para que nada "salte" cuando llegan los
 * datos. `aria-hidden`: el lector de pantalla no tiene nada que leer acá.
 */

function Block({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-inner bg-surface-container", className)} />;
}

export function KpiGridSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Block className="h-4 w-20" />
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        {Array.from({ length: count }, (_, index) => (
          <Block key={index} className="h-[5.5rem] min-w-0" />
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return <Block className={cn("h-48 rounded-card", className)} />;
}

export function TabsSkeleton() {
  return <Block className="h-[3.25rem] rounded-pill" />;
}

/** Pantalla completa de Reportes mientras llega el primer render (loading.tsx). */
export function ReportesSkeleton() {
  return (
    <div className="space-y-lg" role="status" aria-label="Cargando reportes">
      <TabsSkeleton />
      <Block className="h-11 w-full rounded-pill sm:w-48" />
      <KpiGridSkeleton count={4} />
      <KpiGridSkeleton count={8} />
      <CardSkeleton className="h-72" />
      <CardSkeleton />
    </div>
  );
}
