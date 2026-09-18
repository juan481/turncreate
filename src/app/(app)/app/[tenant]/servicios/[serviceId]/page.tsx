import Link from "next/link";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EditServiceForm } from "./edit-service-form";

export default async function EditServicePage({
  params,
}: PageProps<"/app/[tenant]/servicios/[serviceId]">) {
  const { tenant: tenantSlug, serviceId } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: service, error } = await supabase
    .from("services")
    .select("id, name, price, active, buffer_after_min, service_phases(kind, minutes, position)")
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id)
    .single();

  if (error) throw error;

  return (
    <div className="mx-auto max-w-[36rem] space-y-lg">
      <Link
        href={`/app/${tenantSlug}/servicios`}
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Volver a servicios
      </Link>

      <Card hoverLift={false} className="p-xl">
        <h1 className="mb-lg font-headline-sm text-headline-sm text-on-surface">Editar servicio</h1>
        <EditServiceForm
          tenantSlug={tenantSlug}
          service={{
            id: service.id,
            name: service.name,
            price: Number(service.price),
            active: service.active,
            bufferAfterMin: service.buffer_after_min,
            phases: [...service.service_phases]
              .sort((a, b) => a.position - b.position)
              .map((p) => ({ kind: p.kind as "active" | "wait", minutes: p.minutes })),
          }}
        />
      </Card>
    </div>
  );
}
