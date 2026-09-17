import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { timeToMinutes, instantToMinutes } from "@/server/availability";
import { buttonVariants } from "@/components/ui/button";
import { ViewToggle } from "./view-toggle";
import { RealtimeAgendaRefresh } from "./realtime-refresh";
import { AgendaDayGrid } from "./agenda-day-grid";

export default async function AgendaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const dateISO = typeof date === "string" ? date : new TZDate(new Date(), tenant.timezone).toISOString().slice(0, 10);
  const weekday = new TZDate(`${dateISO}T12:00:00`, tenant.timezone).getDay();
  const { startUTC, endUTC } = (() => {
    const start = new TZDate(`${dateISO}T00:00:00`, tenant.timezone);
    const end = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone);
    return { startUTC: start.toISOString(), endUTC: end.toISOString() };
  })();

  const [staffRes, appointmentsRes, businessHoursRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, color")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("display_name"),
    supabase
      .from("appointments")
      .select(
        "id, staff_id, starts_at, ends_at, status, total, clients(full_name), appointment_items(name)",
      )
      .eq("tenant_id", tenant.id)
      .gte("starts_at", startUTC)
      .lte("starts_at", endUTC)
      // Turnos cancelados/vencidos no ocupan lugar visual en la grilla --
      // mueven un turno por drag & drop crea uno nuevo y cancela el
      // viejo (sección 5.3); si se mostrara iría a la vez en su posición
      // vieja (cancelado) y la nueva, como si fueran dos turnos.
      .in("status", ["pending_payment", "confirmed", "completed", "no_show"])
      .order("starts_at"),
    supabase
      .from("business_hours")
      .select("opens_at, closes_at")
      .eq("tenant_id", tenant.id)
      .eq("weekday", weekday),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;
  if (businessHoursRes.error) throw businessHoursRes.error;

  const opensAt = businessHoursRes.data.length > 0
    ? Math.min(...businessHoursRes.data.map((h) => timeToMinutes(h.opens_at)))
    : 8 * 60;
  const closesAt = businessHoursRes.data.length > 0
    ? Math.max(...businessHoursRes.data.map((h) => timeToMinutes(h.closes_at)))
    : 20 * 60;

  const staff = staffRes.data.map((s) => ({
    id: s.id,
    displayName: s.display_name,
    color: s.color,
  }));

  const appointments = appointmentsRes.data.map((a) => ({
    id: a.id,
    staffId: a.staff_id,
    startMinute: instantToMinutes(a.starts_at, tenant.timezone),
    endMinute: instantToMinutes(a.ends_at, tenant.timezone),
    status: a.status,
    clientName: a.clients?.full_name ?? "",
    serviceNames: a.appointment_items.map((i) => i.name).join(", "),
    total: Number(a.total),
  }));

  return (
    <div className="space-y-lg">
      <RealtimeAgendaRefresh tenantId={tenant.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Agenda
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{dateISO}</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle tenantSlug={tenantSlug} dateISO={dateISO} active="day" />
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={buttonVariants({ size: "default" })}
          >
            + Nuevo turno
          </Link>
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay profesionales activos.
        </p>
      ) : (
        <AgendaDayGrid
          tenantSlug={tenantSlug}
          dateISO={dateISO}
          dayStartMinute={opensAt}
          dayEndMinute={closesAt}
          slotIntervalMin={tenant.tenant_settings?.slot_interval_min ?? 15}
          staff={staff}
          appointments={appointments}
        />
      )}
    </div>
  );
}
