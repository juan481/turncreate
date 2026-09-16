import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { NewClientForm } from "./new-client-form";

export default async function ClientesPage({
  params,
}: PageProps<"/app/[tenant]/clientes">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, full_name, phone_e164, email, no_show_count")
    .eq("tenant_id", tenant.id)
    .is("archived_at", null)
    .order("full_name");

  if (error) throw error;

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Clientes
      </h1>

      <Card className="p-lg">
        <NewClientForm tenantSlug={tenantSlug} />
      </Card>

      <Card className="divide-y divide-border p-0">
        {clients.map((client) => (
          <div key={client.id} className="flex items-center justify-between px-lg py-3">
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">{client.full_name}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {client.phone_e164}
                {client.email && ` · ${client.email}`}
              </p>
            </div>
            {client.no_show_count > 0 && (
              <StatusPill status="alert">{client.no_show_count} ausencias</StatusPill>
            )}
          </div>
        ))}
        {clients.length === 0 && (
          <p className="px-lg py-6 font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay clientes cargados.
          </p>
        )}
      </Card>
    </div>
  );
}
