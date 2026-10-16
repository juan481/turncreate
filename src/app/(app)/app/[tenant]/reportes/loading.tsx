import { ReportesSkeleton } from "./skeletons";

/**
 * Se muestra al toque al navegar a Reportes (Next lo prefetchea), mientras
 * el server arranca la página. Después cada sección se streamea por su
 * cuenta con su propio <Suspense> (ver page.tsx).
 */
export default function ReportesLoading() {
  return <ReportesSkeleton />;
}
