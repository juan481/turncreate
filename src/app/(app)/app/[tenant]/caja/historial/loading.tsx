import { CardSkeleton, TabsSkeleton } from "../../reportes/skeletons";

/** Esqueleto del historial de caja (cierres o días). */
export default function CajaHistorialLoading() {
  return (
    <div className="space-y-lg" role="status" aria-label="Cargando historial">
      <TabsSkeleton />
      <CardSkeleton className="h-36" />
      <CardSkeleton className="h-36" />
      <CardSkeleton className="h-36" />
    </div>
  );
}
