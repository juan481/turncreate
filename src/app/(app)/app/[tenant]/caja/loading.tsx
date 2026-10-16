import { CardSkeleton, KpiGridSkeleton, TabsSkeleton } from "../reportes/skeletons";

/** Esqueleto de Caja (Hoy) mientras llegan los turnos y cobros del día. */
export default function CajaLoading() {
  return (
    <div className="space-y-lg" role="status" aria-label="Cargando caja">
      <TabsSkeleton />
      <CardSkeleton className="h-20" />
      <KpiGridSkeleton count={2} />
      <CardSkeleton className="h-64" />
    </div>
  );
}
