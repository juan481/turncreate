import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { ViewToggle } from "./view-toggle";
import { RealtimeAgendaRefresh } from "./realtime-refresh";

const STATUS_LABEL: Record<string, { label: string; pill: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente de pago", pill: "pending" },
  confirmed: { label: "Confirmado", pill: "confirmed" },
  completed: { label: "Completado", pill: "confirmed" },
  no_show: { label: "No vino", pill: "alert" },
  cancelled: { label: "Cancelado", pill: "alert" },
  expired: { label: "Vencido", pill: "alert" },
};

function formatHour(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

export default async function AgendaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const dateISO = typeof date === "string" ? date : new TZDate(new Date(), tenant.timezone).toISOString().slice(0, 10);
  const { startUTC, endUTC } = (() => {
    const start = new TZDate(`${dateISO}T00:00:00`, tenant.timezone);
    const end = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone);
    return { startUTC: start.toISOString(), endUTC: end.toISOString() };
  })();

  const [staffRes, appointmentsRes] = await Promise.all([
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
      .order("starts_at"),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const appointmentsByStaff = new Map<string, typeof appointmentsRes.data>();
  for (const appointment of appointmentsRes.data) {
    const list = appointmentsByStaff.get(appointment.staff_id) ?? [];
    list.push(appointment);
    appointmentsByStaff.set(appointment.staff_id, list);
  }

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

      <div className="grid gap-md md:grid-cols-2 lg:grid-cols-4">
        {staffRes.data.map((staff) => {
          const appointments = appointmentsByStaff.get(staff.id) ?? [];
          return (
            <Card key={staff.id} className="space-y-3 p-lg">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: staff.color ?? "#767582" }}
                />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {staff.display_name}
                </h2>
              </div>

              <div className="space-y-2">
                {appointments.map((appointment) => {
                  const status = STATUS_LABEL[appointment.status] ?? {
                    label: appointment.status,
                    pill: "pending" as StatusPillStatus,
                  };
                  return (
                    <Link
                      key={appointment.id}
                      href={`/app/${tenantSlug}/agenda/${appointment.id}`}
                      className="block rounded-inner bg-surface-muted p-3 transition-colors hover:bg-secondary-soft"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md text-on-surface">
                          {formatHour(appointment.starts_at, tenant.timezone)}–
                          {formatHour(appointment.ends_at, tenant.timezone)}
                        </span>
                        <StatusPill status={status.pill}>{status.label}</StatusPill>
                      </div>
                      <p className="mt-1 font-body-sm text-body-sm text-on-surface">
                        {appointment.clients?.full_name}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {appointment.appointment_items.map((i) => i.name).join(", ")}
                      </p>
                    </Link>
                  );
                })}
                {appointments.length === 0 && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Sin turnos.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
