import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { timeToMinutes, instantToMinutes } from "@/server/availability";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ViewToggle } from "./view-toggle";
import { DateNav } from "./date-nav";
import { RealtimeAgendaRefresh } from "./realtime-refresh";
import { AgendaDayGrid } from "./agenda-day-grid";
import { SimpleAgendaList } from "./simple-agenda-list";

export default async function AgendaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const now = new TZDate(new Date(), tenant.timezone);
  const todayISO = format(now, "yyyy-MM-dd");
  const dateISO = typeof date === "string" ? date : todayISO;
  const nowMinute = dateISO === todayISO ? now.getHours() * 60 + now.getMinutes() : null;
  const weekday = new TZDate(`${dateISO}T12:00:00`, tenant.timezone).getDay();
  const { startUTC, endUTC } = (() => {
    const start = new TZDate(`${dateISO}T00:00:00`, tenant.timezone);
    const end = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone);
    return { startUTC: start.toISOString(), endUTC: end.toISOString() };
  })();

  const [staffRes, appointmentsRes, businessHoursRes, staffServicesRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, color, photo_url")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("display_name"),
    supabase
      .from("appointments")
      .select(
        "id, staff_id, starts_at, ends_at, status, total, balance, clients(full_name), appointment_items(name)",
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
    supabase
      .from("staff_services")
      .select("staff_id, services(service_categories(name))")
      .eq("services.tenant_id", tenant.id),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;
  if (businessHoursRes.error) throw businessHoursRes.error;
  if (staffServicesRes.error) throw staffServicesRes.error;

  // Especialidad mostrada en cada columna: se deriva de las categorías de
  // los servicios que la persona atiende (staff_services), no es un campo
  // propio -- así se mantiene sincronizada sola cuando cambia el catálogo.
  const specialtyByStaff = new Map<string, string>();
  for (const row of staffServicesRes.data) {
    const categoryName = row.services?.service_categories?.name;
    if (!categoryName) continue;
    const current = specialtyByStaff.get(row.staff_id);
    const names = new Set((current ?? "").split(", ").filter(Boolean));
    names.add(categoryName);
    specialtyByStaff.set(row.staff_id, Array.from(names).join(", "));
  }

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
    photoUrl: s.photo_url,
    specialty: staffRes.data.length > 1 ? specialtyByStaff.get(s.id) ?? null : null,
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
    balance: Number(a.balance),
  }));

  return (
    <div className="space-y-lg">
      <RealtimeAgendaRefresh tenantId={tenant.id} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-sm">
          <DateNav tenantSlug={tenantSlug} dateISO={dateISO} />
          {staff.length > 1 && (
            <div className="flex items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface-variant">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-confirmed-dot" />
              {staff.length} profesionales trabajando hoy
            </div>
          )}
          <div className="flex items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-md text-label-md text-on-surface-variant">
            <Icon name="event" className="text-[16px]" />
            {appointments.length} turno{appointments.length === 1 ? "" : "s"} hoy
          </div>
        </div>
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <ViewToggle tenantSlug={tenantSlug} dateISO={dateISO} active="day" />
          {/* En mobile el FAB ya cubre "turno nuevo": con el botón acá la
              fila mide más que el ancho disponible y self-end empuja el
              sobrante fuera del borde izquierdo. */}
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={cn(buttonVariants({ size: "default" }), "hidden sm:inline-flex")}
          >
            <Icon name="add" className="text-[18px]" />
            Nuevo Turno
          </Link>
        </div>
      </div>

      {staff.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Todavía no hay profesionales activos.
        </p>
      ) : staff.length === 1 ? (
        <SimpleAgendaList tenantSlug={tenantSlug} appointments={appointments} />
      ) : (
        <AgendaDayGrid
          tenantSlug={tenantSlug}
          dateISO={dateISO}
          dayStartMinute={opensAt}
          dayEndMinute={closesAt}
          slotIntervalMin={tenant.tenant_settings?.slot_interval_min ?? 15}
          staff={staff}
          appointments={appointments}
          nowMinute={nowMinute}
        />
      )}
    </div>
  );
}
