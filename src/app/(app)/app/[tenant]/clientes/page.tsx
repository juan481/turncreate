import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { NewClientForm } from "./new-client-form";
import { ClientsList } from "./clients-list";

export default async function ClientesPage({
  params,
}: PageProps<"/app/[tenant]/clientes">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [clientsRes, statsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, phone_e164, email, no_show_count")
      .eq("tenant_id", tenant.id)
      .is("archived_at", null)
      .order("full_name"),
    supabase.from("client_stats").select("client_id, last_visit_at").eq("tenant_id", tenant.id),
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (statsRes.error) throw statsRes.error;

  const lastVisitByClient = new Map(statsRes.data.map((s) => [s.client_id, s.last_visit_at]));
  const clients = clientsRes.data.map((c) => ({
    ...c,
    lastVisitAt: lastVisitByClient.get(c.id) ?? null,
  }));

  return (
    <div className="space-y-lg">
      <SectionHeaderNew
        title="Clientes"
        subtitle={`${clients.length} cliente${clients.length === 1 ? "" : "s"} cargado${clients.length === 1 ? "" : "s"}`}
        newLabel="Nuevo cliente"
        newIcon="person_add"
      >
        <NewClientForm tenantSlug={tenantSlug} />
      </SectionHeaderNew>

      <ClientsList tenantSlug={tenantSlug} clients={clients} />
    </div>
  );
}
