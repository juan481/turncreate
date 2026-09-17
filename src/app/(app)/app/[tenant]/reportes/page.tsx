import { ReportesClient } from "./ReportesClient";

// If you have a specific type for page props, you can use it, but this covers Next.js 15
export default async function ReportesPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;

  // Datos simulados por ahora, como indica el requerimiento
  const stats = {
    ingresosMes: "$ 450,000",
    serviciosPopulares: [
      { name: "Corte Clásico", count: 120 },
      { name: "Barba y Perfilado", count: 85 },
      { name: "Corte y Barba", count: 40 },
    ],
    tasaAusentismo: "8.5%"
  };

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Reportes
      </h1>
      
      <ReportesClient tenantSlug={tenantSlug} stats={stats} />
    </div>
  );
}
