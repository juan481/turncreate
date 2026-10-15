import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { listServiceCategories } from "@/server/services/catalog";
import { NewServiceForm } from "../new-service-form";

export default async function NewServicePage({ params }: PageProps<"/app/[tenant]/servicios/nuevo">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) notFound();
  const categories = await listServiceCategories(tenant.id);

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div className="hidden lg:block">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Nuevo servicio</h1>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Con nombre, precio y duración alcanza. Lo demás lo podés completar después.
      </p>
      <Card hoverLift={false} className="p-4 sm:p-xl">
        <NewServiceForm tenantSlug={tenantSlug} categories={categories} />
      </Card>
    </div>
  );
}
