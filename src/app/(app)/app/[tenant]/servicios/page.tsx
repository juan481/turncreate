import Link from "next/link";
import { computeTotalDuration } from "@/domain/availability";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/schemas/service";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { listServiceCategories, listServices } from "@/server/services/catalog";
import { CategoryManager } from "./category-manager";
import { CatalogList, type CatalogGroup } from "./catalog-list";

export default async function ServiciosPage({ params }: PageProps<"/app/[tenant]/servicios">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);

  const [categories, services] = await Promise.all([
    listServiceCategories(tenant.id),
    listServices(tenant.id),
  ]);

  // Categorías reales primero (en su orden, aunque estén vacías, para poder
  // ordenarlas antes de cargarles servicios); después "Otros servicios" y
  // cualquier categoría vieja sin documento propio.
  const categoryIds = new Set(categories.map((category) => category.id));
  const groups: CatalogGroup[] = categories.map((category) => ({ id: category.id, name: category.name, isCategory: true, services: [] }));
  const extraGroups = new Map<string, CatalogGroup>();
  for (const service of services) {
    const row = {
      id: service.id,
      name: service.name,
      price: service.price,
      duration: computeTotalDuration(service.phases, service.bufferAfterMin),
      active: service.active,
      public: service.public,
      featured: service.featured,
    };
    if (service.categoryId && categoryIds.has(service.categoryId)) {
      groups.find((group) => group.id === service.categoryId)!.services.push(row);
      continue;
    }
    const name = service.categoryName || UNCATEGORIZED_CATEGORY_NAME;
    const id = name === UNCATEGORIZED_CATEGORY_NAME ? "uncategorized" : `legacy:${name.toLocaleLowerCase("es-AR")}`;
    const group = extraGroups.get(id) ?? { id, name, isCategory: false, services: [] };
    group.services.push(row);
    extraGroups.set(id, group);
  }
  const allGroups = [...groups, ...extraGroups.values()];

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden lg:block">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Servicios</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {services.length} servicio{services.length === 1 ? "" : "s"} en el catálogo
          </p>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant lg:hidden">
          {services.length} servicio{services.length === 1 ? "" : "s"} en el catálogo
        </p>
        <Link href={`/app/${tenantSlug}/servicios/nuevo`} className={buttonVariants()}>
          <Icon name="add" className="text-[18px]" />
          Nuevo servicio
        </Link>
      </div>

      <CategoryManager tenantSlug={tenantSlug} categories={categories} />

      {services.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 px-1 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="drag_indicator" className="mt-0.5 shrink-0 text-[16px]" />
            <span>
              Arrastrá para ordenar: <strong className="font-semibold text-on-surface">en este mismo orden lo ve tu clienta</strong> en el turnero. Tocá la <Icon name="star" className="text-[13px] text-status-draft-dot" /> para destacar un servicio.
            </span>
          </p>
          {/* La key cambia cuando cambian los datos del servidor (categoría
              nueva/renombrada, destacado, orden) para que la lista local
              arranque de nuevo desde ellos en vez de quedar desfasada. */}
          <CatalogList key={allGroups.map((group) => `${group.id}:${group.name}:${group.services.map((s) => `${s.id}${s.featured ? "*" : ""}`).join(",")}`).join("|")} tenantSlug={tenantSlug} groups={allGroups} />
        </div>
      ) : (
        <Card hoverLift={false} className="py-10 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low text-secondary">
            <Icon name="spa" className="text-[24px]" />
          </span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Todavía no hay servicios</h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Cargá el primero con nombre, precio y duración. La categoría es opcional.
          </p>
          <Link href={`/app/${tenantSlug}/servicios/nuevo`} className={`${buttonVariants()} mt-4`}>
            Crear mi primer servicio
          </Link>
        </Card>
      )}
    </div>
  );
}
