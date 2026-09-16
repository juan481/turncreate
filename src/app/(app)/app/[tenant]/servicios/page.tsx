import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { computeTotalDuration, type Phase } from "@/domain/availability";
import { Card } from "@/components/ui/card";
import { NewServiceForm } from "./new-service-form";

export default async function ServiciosPage({
  params,
}: PageProps<"/app/[tenant]/servicios">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, price, buffer_after_min, active, service_phases(kind, minutes)")
    .eq("tenant_id", tenant.id)
    .is("archived_at", null)
    .order("sort");

  if (error) throw error;

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Servicios
        </h1>
      </div>

      <Card className="p-lg">
        <NewServiceForm tenantSlug={tenantSlug} />
      </Card>

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const phases: Phase[] = service.service_phases.map((p) => ({
            kind: p.kind as Phase["kind"],
            minutes: p.minutes,
          }));
          const duration = computeTotalDuration(phases, service.buffer_after_min);

          return (
            <Card key={service.id} className="space-y-1 p-lg">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                {service.name}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {duration} min
                {service.buffer_after_min > 0 && ` (incluye ${service.buffer_after_min} de buffer)`}
              </p>
              <p className="font-label-lg text-label-lg text-on-surface">
                ${Number(service.price).toLocaleString("es-AR")}
              </p>
            </Card>
          );
        })}
        {services.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay servicios cargados.
          </p>
        )}
      </div>
    </div>
  );
}
