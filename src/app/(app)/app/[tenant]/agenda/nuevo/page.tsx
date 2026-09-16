import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { getAvailableSlotsForStaff, getServiceCombo } from "@/server/availability";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmSlotButton } from "./confirm-slot-button";

function formatHour(date: Date, timezone: string) {
  const zoned = new TZDate(date, timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

export default async function NuevoTurnoPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/nuevo">) {
  const { tenant: tenantSlug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const dateISO =
    typeof sp.date === "string" ? sp.date : new TZDate(new Date(), tenant.timezone).toISOString().slice(0, 10);
  const staffId = typeof sp.staffId === "string" ? sp.staffId : undefined;
  const serviceId = typeof sp.serviceId === "string" ? sp.serviceId : undefined;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const rescheduleFrom = typeof sp.rescheduleFrom === "string" ? sp.rescheduleFrom : undefined;

  const [staffRes, servicesRes, clientsRes] = await Promise.all([
    supabase.from("staff").select("id, display_name").eq("tenant_id", tenant.id).eq("active", true),
    supabase.from("services").select("id, name").eq("tenant_id", tenant.id).eq("active", true),
    supabase.from("clients").select("id, full_name").eq("tenant_id", tenant.id).is("archived_at", null),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (clientsRes.error) throw clientsRes.error;

  const settings = tenant.tenant_settings;
  const slots =
    staffId && serviceId
      ? await (async () => {
          const combo = await getServiceCombo(supabase, [serviceId]);
          return getAvailableSlotsForStaff(supabase, {
            tenantId: tenant.id,
            staffId,
            dateISO,
            timezone: tenant.timezone,
            combo,
            slotIntervalMin: settings?.slot_interval_min ?? 15,
            minNoticeMin: settings?.min_notice_min ?? 60,
          });
        })()
      : [];

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        {rescheduleFrom ? "Reprogramar turno" : "Nuevo turno"}
      </h1>

      <Card className="p-lg">
        <form className="grid gap-3 sm:grid-cols-4" method="GET">
          {rescheduleFrom && <input type="hidden" name="rescheduleFrom" value={rescheduleFrom} />}
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">Cliente</label>
            <select
              name="clientId"
              defaultValue={clientId}
              required
              className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
            >
              <option value="" disabled>
                Elegir…
              </option>
              {clientsRes.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Profesional
            </label>
            <select
              name="staffId"
              defaultValue={staffId}
              required
              className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
            >
              <option value="" disabled>
                Elegir…
              </option>
              {staffRes.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">Servicio</label>
            <select
              name="serviceId"
              defaultValue={serviceId}
              required
              className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
            >
              <option value="" disabled>
                Elegir…
              </option>
              {servicesRes.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">Fecha</label>
            <input
              type="date"
              name="date"
              defaultValue={dateISO}
              className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
            />
          </div>
          <Button type="submit" className="sm:col-span-4 justify-self-start">
            Ver horarios disponibles
          </Button>
        </form>
      </Card>

      {staffId && serviceId && clientId && (
        <Card className="space-y-3 p-lg">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">
            Horarios disponibles
          </h2>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <ConfirmSlotButton
                key={slot.startsAt.toISOString()}
                tenantSlug={tenantSlug}
                staffId={staffId}
                clientId={clientId}
                serviceId={serviceId}
                dateISO={dateISO}
                startsAtISO={slot.startsAt.toISOString()}
                label={formatHour(slot.startsAt, tenant.timezone)}
                rescheduleFrom={rescheduleFrom}
              />
            ))}
            {slots.length === 0 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                No hay horarios disponibles para esa combinación.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
