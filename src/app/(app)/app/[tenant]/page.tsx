import { Card } from "@/components/ui/card";

export default async function TenantDashboardPage({
  params,
}: PageProps<"/app/[tenant]">) {
  const { tenant } = await params;

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Hoy en {tenant}
      </h1>
      {/* TODO Fase 1: agenda del día real (business_hours + appointment_segments) */}
      <Card className="p-lg">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          La agenda, clientes y caja se conectan en las Fases 1 y 5 del plan.
        </p>
      </Card>
    </div>
  );
}
