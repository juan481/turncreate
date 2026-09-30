import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { EditServiceForm } from "./edit-service-form";

export default async function EditServicePage({ params }: PageProps<"/app/[tenant]/servicios/[serviceId]">) {
  const { tenant: tenantSlug, serviceId } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) notFound();
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc(serviceId).get();
  if (!doc.exists) notFound();
  const service = doc.data() as { id: string; name: string; price: number; active: boolean; bufferAfterMin: number; phases: { kind: "active" | "wait"; minutes: number; position: number }[] };
  return <div className="mx-auto max-w-[36rem] space-y-lg"><Link href={`/app/${tenantSlug}/servicios`} className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"><Icon name="arrow_back" className="text-[16px]" />Volver a servicios</Link><Card hoverLift={false} className="p-xl"><h1 className="mb-lg font-headline-sm text-headline-sm text-on-surface">Editar servicio</h1><EditServiceForm tenantSlug={tenantSlug} service={{ ...service, phases: [...(service.phases ?? [])].sort((a, b) => a.position - b.position).map(({ kind, minutes }) => ({ kind, minutes })) }} /></Card></div>;
}
