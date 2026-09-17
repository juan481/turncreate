import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";

export default async function TenantDashboardPage({
  params,
}: PageProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const today = new TZDate(new Date(), tenant.timezone);
  const dateISO = today.toISOString().slice(0, 10);
  const startUTC = new TZDate(`${dateISO}T00:00:00`, tenant.timezone).toISOString();
  const endUTC = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("total, status")
    .eq("tenant_id", tenant.id)
    .gte("starts_at", startUTC)
    .lte("starts_at", endUTC)
    .in("status", ["confirmed", "completed"]);

  if (error) throw error;

  const turnosHoy = appointments.length;
  const ingresosHoy = appointments.reduce((sum, a) => sum + Number(a.total), 0);
  const ticketPromedio = turnosHoy > 0 ? ingresosHoy / turnosHoy : 0;

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Hoy en {tenant.name}
      </h1>

      <div className="grid grid-cols-1 gap-md md:grid-cols-3">
        <Card className="flex flex-col gap-xs p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Ingresos hoy</p>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            ${ingresosHoy.toLocaleString("es-AR")}
          </p>
        </Card>

        <Card className="flex flex-col gap-xs p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Turnos hoy</p>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {turnosHoy}
          </p>
        </Card>

        <Card className="flex flex-col gap-xs p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Ticket promedio</p>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            ${ticketPromedio.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
          </p>
        </Card>
      </div>
    </div>
  );
}
