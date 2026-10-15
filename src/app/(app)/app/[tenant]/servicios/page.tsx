import Link from "next/link";
import { computeTotalDuration } from "@/domain/availability";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/schemas/service";
import { iconForService } from "@/lib/service-icon";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { listServiceCategories, listServices, type ServiceRecord } from "@/server/services/catalog";
import { CategoryManager } from "./category-manager";
import { NewServiceForm } from "./new-service-form";

type ServiceGroup = { id: string; name: string; services: ServiceRecord[] };

export default async function ServiciosPage({ params }: PageProps<"/app/[tenant]/servicios">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const [categories, services] = await Promise.all([
    listServiceCategories(tenant.id),
    listServices(tenant.id),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const groupMap = new Map<string, ServiceGroup>();

  for (const service of services) {
    const category = service.categoryId ? categoryById.get(service.categoryId) : undefined;
    const name = category?.name ?? service.categoryName ?? UNCATEGORIZED_CATEGORY_NAME;
    const id = category?.id ?? service.categoryId ?? (name === UNCATEGORIZED_CATEGORY_NAME ? "uncategorized" : `legacy:${name.toLocaleLowerCase("es-AR")}`);
    const group = groupMap.get(id) ?? { id, name, services: [] };
    group.services.push(service);
    groupMap.set(id, group);
  }

  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const groups = [...groupMap.values()].sort((left, right) => {
    const leftOrder = categoryOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = categoryOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.name.localeCompare(right.name, "es");
  });

  return (
    <div className="space-y-lg">
      <SectionHeaderNew
        title="Servicios"
        subtitle={`${services.length} servicio${services.length === 1 ? "" : "s"} en el catálogo`}
        newLabel="Nuevo servicio"
        newIcon="add_circle"
      >
        <NewServiceForm tenantSlug={tenantSlug} categories={categories} />
      </SectionHeaderNew>

      <CategoryManager tenantSlug={tenantSlug} categories={categories} />

      {groups.map((group) => (
        <section key={group.id} className="space-y-3" aria-labelledby={`service-group-${group.id}`}>
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 id={`service-group-${group.id}`} className="min-w-0 truncate font-headline-sm text-headline-sm text-on-surface">
              {group.name}
            </h2>
            <span className="shrink-0 rounded-pill bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">
              {group.services.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.services.map((service) => {
              const duration = computeTotalDuration(service.phases, service.bufferAfterMin);
              return (
                <Link key={service.id} href={`/app/${tenantSlug}/servicios/${service.id}`} className="min-w-0">
                  <Card className="flex h-full min-w-0 flex-col gap-3 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-secondary">
                        <Icon name={iconForService(service.name)} className="text-[20px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="min-w-0 break-words font-headline-sm text-headline-sm text-on-surface">
                            {service.name}
                          </h3>
                          <Icon name="chevron_right" className="mt-0.5 shrink-0 text-[18px] text-on-surface-variant" />
                        </div>
                        {service.description && (
                          <p className="mt-1 line-clamp-2 break-words font-body-sm text-body-sm text-on-surface-variant">
                            {service.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {!service.active && (
                        <span className="rounded-pill bg-status-draft-bg px-2.5 py-1 font-label-sm text-label-sm text-status-draft">
                          Pausado
                        </span>
                      )}
                      <span className={`rounded-pill px-2.5 py-1 font-label-sm text-label-sm ${service.public ? "bg-status-confirmed-bg text-status-confirmed" : "bg-surface-container text-on-surface-variant"}`}>
                        {service.public ? "En el turnero" : "Solo interno"}
                      </span>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
                      <p className="flex min-w-0 items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                        <Icon name="schedule" className="shrink-0 text-[16px]" />
                        <span>{duration} min{service.bufferAfterMin > 0 ? ` · ${service.bufferAfterMin} min de margen` : ""}</span>
                      </p>
                      <p className="shrink-0 font-headline-sm text-headline-sm tabular-nums text-on-surface">
                        ${service.price.toLocaleString("es-AR")}
                      </p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {services.length === 0 && (
        <Card hoverLift={false} className="py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-secondary">
            <Icon name="spa" className="text-[24px]" />
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Todavía no hay servicios</h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Creá una categoría y agregá tu primer servicio.
          </p>
        </Card>
      )}
    </div>
  );
}
