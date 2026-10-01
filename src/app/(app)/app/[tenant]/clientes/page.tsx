import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { NewClientForm } from "./new-client-form";
import { ClientsList } from "./clients-list";

export default async function ClientesPage({ params }: PageProps<"/app/[tenant]/clientes">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("clients").orderBy("fullNameNormalized").get();
  const clients = snapshot.docs.map((doc) => doc.data()).filter((client) => !client.archivedAt).map((client) => ({ id: client.id as string, full_name: client.fullName as string, photo_url: (client.photoUrl as string | null) ?? null, phone_e164: client.phoneE164 as string, email: (client.email as string | null) ?? null, no_show_count: Number(client.noShowCount ?? 0), lastVisitAt: client.lastVisitAt?.toDate?.().toISOString?.() ?? null }));
  return <div className="space-y-lg"><SectionHeaderNew title="Clientes" subtitle={`${clients.length} cliente${clients.length === 1 ? "" : "s"} cargado${clients.length === 1 ? "" : "s"}`} newLabel="Nuevo cliente" newIcon="person_add"><NewClientForm tenantSlug={tenantSlug} /></SectionHeaderNew><ClientsList tenantSlug={tenantSlug} clients={clients} /></div>;
}
