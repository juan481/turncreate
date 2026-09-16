import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { ClientNotes } from "./client-notes";

export default async function ClientDetailPage({
  params,
}: PageProps<"/app/[tenant]/clientes/[clientId]">) {
  const { tenant: tenantSlug, clientId } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [clientRes, statsRes, notesRes, appointmentsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).eq("tenant_id", tenant.id).single(),
    supabase.from("client_stats").select("*").eq("client_id", clientId).eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("client_notes").select("id, body, created_at, is_clinical").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("appointments").select("id, starts_at, status, total, staff(display_name)").eq("client_id", clientId).order("starts_at", { ascending: false }).limit(10)
  ]);

  if (clientRes.error) throw clientRes.error;
  if (notesRes.error) throw notesRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const client = clientRes.data;
  const stats = statsRes.data;

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-4">
        <Link href={`/app/${tenantSlug}/clientes`} className="text-on-surface-variant font-label-md hover:underline">← Volver</Link>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          {client.full_name}
        </h1>
      </div>

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="space-y-lg lg:col-span-1">
          <Card className="p-lg space-y-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Datos de Contacto</h2>
            <div>
              <p className="font-label-md text-label-md text-on-surface-variant">Teléfono</p>
              <p className="font-body-md text-body-md text-on-surface">{client.phone_e164}</p>
            </div>
            {client.email && (
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant">Email</p>
                <p className="font-body-md text-body-md text-on-surface">{client.email}</p>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-4">
              <div className="text-center">
                <p className="font-label-md text-on-surface-variant">Turnos</p>
                <p className="font-headline-md text-on-surface">{stats?.appointments_count ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-on-surface-variant">Gastado</p>
                <p className="font-headline-md text-on-surface">${Number(stats?.total_spent ?? 0).toLocaleString("es-AR")}</p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-on-surface-variant">Ausencias</p>
                <p className="font-headline-md text-status-alert">{client.no_show_count}</p>
              </div>
            </div>
          </Card>
          
          <ClientNotes tenantSlug={tenantSlug} clientId={client.id} notes={notesRes.data} />
        </div>

        <div className="space-y-lg lg:col-span-2">
          <Card className="p-0">
            <div className="p-lg border-b border-border">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Últimos turnos</h2>
            </div>
            <div className="divide-y divide-border">
              {appointmentsRes.data.map(app => (
                <Link key={app.id} href={`/app/${tenantSlug}/agenda/${app.id}`} className="block px-lg py-4 hover:bg-surface-muted transition-colors">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-label-md text-on-surface">{new TZDate(app.starts_at, tenant.timezone).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}</p>
                      <p className="font-body-sm text-on-surface-variant">{app.staff?.display_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-label-md text-on-surface">${Number(app.total).toLocaleString("es-AR")}</p>
                      <p className="font-body-sm text-on-surface-variant">{app.status}</p>
                    </div>
                  </div>
                </Link>
              ))}
              {appointmentsRes.data.length === 0 && (
                <p className="p-lg font-body-md text-on-surface-variant">No hay turnos registrados.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
