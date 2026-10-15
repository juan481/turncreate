import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { computeTotalDuration } from "@/domain/availability";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getService, listServiceCategories } from "@/server/services/catalog";
import { EditServiceForm } from "./edit-service-form";

export default async function EditServicePage({ params }: PageProps<"/app/[tenant]/servicios/[serviceId]">) {
  const { tenant: tenantSlug, serviceId } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) notFound();

  const [service, categories] = await Promise.all([
    getService(tenant.id, serviceId),
    listServiceCategories(tenant.id),
  ]);
  if (!service) notFound();

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      {/* En mobile el AppBar ya trae el ‹volver; esto queda solo para desktop. */}
      <Link
        href={`/app/${tenantSlug}/servicios`}
        className="hidden min-h-11 items-center gap-2 rounded-pill pr-3 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-muted hover:text-on-surface lg:inline-flex"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low">
          <Icon name="arrow_back" className="text-[18px]" />
        </span>
        Volver a servicios
      </Link>
      <Card hoverLift={false} className="p-4 sm:p-xl">
        <div className="mb-lg">
          <h1 className="font-headline-sm text-headline-sm text-on-surface">Editar servicio</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Lo que guardes acá se usa también en el catálogo público.
          </p>
        </div>
        <EditServiceForm
          tenantSlug={tenantSlug}
          categories={categories}
          service={{
            id: service.id,
            name: service.name,
            price: service.price,
            active: service.active,
            public: service.public,
            description: service.description,
            categoryId: service.categoryId,
            // Servicios viejos con fases/margen: se muestra el tiempo total que
            // bloqueaban en la agenda, así al guardar no cambia su duración real.
            durationMin: computeTotalDuration(service.phases, service.bufferAfterMin),
          }}
        />
      </Card>
    </div>
  );
}
