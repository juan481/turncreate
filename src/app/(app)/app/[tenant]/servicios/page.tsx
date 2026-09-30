import Link from "next/link";
import { computeTotalDuration, type Phase } from "@/domain/availability";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { NewServiceForm } from "./new-service-form";

type FirebaseService = { id: string; name: string; price: number; bufferAfterMin: number; active: boolean; archivedAt: unknown; phases: Phase[] };

export default async function ServiciosPage({ params }: PageProps<"/app/[tenant]/servicios">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").orderBy("sort").get();
  const services = snapshot.docs.map((doc) => doc.data() as FirebaseService).filter((service) => !service.archivedAt);
  return <div className="space-y-lg"><SectionHeaderNew title="Servicios" subtitle={`${services.length} servicio${services.length === 1 ? "" : "s"} en el catálogo`} newLabel="Nuevo servicio" newIcon="add_circle"><NewServiceForm tenantSlug={tenantSlug} /></SectionHeaderNew><div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">{services.map((service) => { const duration = computeTotalDuration(service.phases ?? [], service.bufferAfterMin ?? 0); return <Link key={service.id} href={`/app/${tenantSlug}/servicios/${service.id}`}><Card className="flex h-full flex-col gap-2 p-lg"><div className="flex items-start justify-between gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-secondary"><Icon name="content_cut" className="text-[20px]" /></span>{!service.active && <StatusPill status="draft">Inactivo</StatusPill>}</div><h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">{service.name}<Icon name="edit" className="text-[14px] text-on-surface-variant" /></h2><p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant"><Icon name="schedule" className="text-[15px]" />{duration} min{service.bufferAfterMin > 0 && ` (incluye ${service.bufferAfterMin} de buffer)`}</p><p className="font-headline-sm text-headline-sm text-on-surface">${Number(service.price).toLocaleString("es-AR")}</p></Card></Link>; })}{services.length === 0 && <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay servicios cargados.</p>}</div></div>;
}
