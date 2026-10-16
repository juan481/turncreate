import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { NewClientSection } from "./new-client-section";
import { ClientsList } from "./clients-list";

export default async function ClientesPage({ params, searchParams }: PageProps<"/app/[tenant]/clientes">) {
  const { tenant: tenantSlug } = await params;
  const { nuevo } = await searchParams;
  const { tenant } = await requireTenantPage(tenantSlug);
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("clients").orderBy("fullNameNormalized").get();
  const clients = snapshot.docs.map((doc) => doc.data()).filter((client) => !client.archivedAt).map((client) => ({ id: client.id as string, full_name: client.fullName as string, photo_url: (client.photoUrl as string | null) ?? null, phone_e164: client.phoneE164 as string, email: (client.email as string | null) ?? null, no_show_count: Number(client.noShowCount ?? 0), lastVisitAt: client.lastVisitAt?.toDate?.().toISOString?.() ?? null }));
  const subtitle = `${clients.length} cliente${clients.length === 1 ? "" : "s"} cargado${clients.length === 1 ? "" : "s"}`;
  return (
    <div className="space-y-lg">
      {/* ?nuevo=1 (acceso "Nuevo cliente" del botón flotante) abre el formulario directo. */}
      <NewClientSection tenantSlug={tenantSlug} subtitle={subtitle} requestedOpen={nuevo === "1"} />
      <ClientsList tenantSlug={tenantSlug} clients={clients} />
    </div>
  );
}
