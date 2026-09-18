import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { ClientNotes } from "./client-notes";

const STATUS_LABEL: Record<string, { label: string; pill: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente de pago", pill: "pending" },
  confirmed: { label: "Confirmado", pill: "confirmed" },
  completed: { label: "Completado", pill: "confirmed" },
  no_show: { label: "No vino", pill: "alert" },
  cancelled: { label: "Cancelado", pill: "alert" },
  expired: { label: "Vencido", pill: "alert" },
};

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
    supabase.from("appointments").select("id, starts_at, status, total, staff(display_name, photo_url)").eq("client_id", clientId).order("starts_at", { ascending: false }).limit(10)
  ]);

  if (clientRes.error) throw clientRes.error;
  if (notesRes.error) throw notesRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const client = clientRes.data;
  const stats = statsRes.data;

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-4">
        <Link
          href={`/app/${tenantSlug}/clientes`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container"
          aria-label="Volver"
        >
          <Icon name="arrow_back" className="text-[18px]" />
        </Link>
        <Avatar name={client.full_name} size="md" />
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          {client.full_name}
        </h1>
      </div>

      <div className="grid gap-lg lg:grid-cols-3">
        <div className="space-y-lg lg:col-span-1">
          <Card hoverLift={false} className="space-y-4 p-lg">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Datos de contacto</h2>
            <div className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
              <Icon name="call" className="text-[18px] text-on-surface-variant" />
              {client.phone_e164}
            </div>
            {client.email && (
              <div className="flex items-center gap-2 font-body-md text-body-md text-on-surface">
                <Icon name="mail" className="text-[18px] text-on-surface-variant" />
                {client.email}
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-4">
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Turnos</p>
                <p className="font-headline-md text-headline-md text-on-surface">{stats?.appointments_count ?? 0}</p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Gastado</p>
                <p className="font-headline-md text-headline-md text-on-surface">
                  ${Number(stats?.total_spent ?? 0).toLocaleString("es-AR")}
                </p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Ausencias</p>
                <p className="font-headline-md text-headline-md text-status-alert">{client.no_show_count}</p>
              </div>
            </div>
          </Card>

          <ClientNotes tenantSlug={tenantSlug} clientId={client.id} notes={notesRes.data} />
        </div>

        <div className="space-y-lg lg:col-span-2">
          <Card hoverLift={false} className="p-0">
            <div className="border-b border-border p-lg">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Últimos turnos</h2>
            </div>
            <div className="divide-y divide-border">
              {appointmentsRes.data.map((app) => {
                const status = STATUS_LABEL[app.status] ?? { label: app.status, pill: "pending" as StatusPillStatus };
                return (
                  <Link
                    key={app.id}
                    href={`/app/${tenantSlug}/agenda/${app.id}`}
                    className="flex items-center gap-3 px-lg py-4 transition-colors hover:bg-surface-container-low"
                  >
                    <Avatar name={app.staff?.display_name ?? ""} src={app.staff?.photo_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {new TZDate(app.starts_at, tenant.timezone).toLocaleString("es-AR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                        {app.staff?.display_name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-label-md text-label-md text-on-surface">
                        ${Number(app.total).toLocaleString("es-AR")}
                      </p>
                      <StatusPill status={status.pill}>{status.label}</StatusPill>
                    </div>
                  </Link>
                );
              })}
              {appointmentsRes.data.length === 0 && (
                <p className="p-lg font-body-md text-body-md text-on-surface-variant">
                  No hay turnos registrados.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
