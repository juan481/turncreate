import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { getAvailableSlotsForStaff, getServiceCombo, getStaffIdsForService } from "@/server/availability";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ClientField } from "./client-field";
import { SlotsAndDeposit } from "./slots-and-deposit";

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
  const serviceId = typeof sp.serviceId === "string" ? sp.serviceId : undefined;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const rescheduleFrom = typeof sp.rescheduleFrom === "string" ? sp.rescheduleFrom : undefined;
  const keepDeposit = sp.keepDeposit !== "false";

  const [staffRes, servicesRes, clientsRes] = await Promise.all([
    supabase.from("staff").select("id, display_name").eq("tenant_id", tenant.id).eq("active", true),
    supabase.from("services").select("id, name, price").eq("tenant_id", tenant.id).eq("active", true),
    supabase.from("clients").select("id, full_name").eq("tenant_id", tenant.id).is("archived_at", null),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (clientsRes.error) throw clientsRes.error;

  // Con un solo profesional activo, preguntar "¿con quién?" es ruido --
  // se asigna directo y el selector ni se muestra.
  const soloStaffId = staffRes.data.length === 1 ? staffRes.data[0].id : undefined;
  const staffId = soloStaffId ?? (typeof sp.staffId === "string" ? sp.staffId : undefined);

  const settings = tenant.tenant_settings;
  const slots =
    staffId && serviceId
      ? await (async () => {
          const combo = await getServiceCombo(supabase, [serviceId]);

          if (staffId === "any") {
            const eligibleStaffIds = await getStaffIdsForService(supabase, {
              tenantId: tenant.id,
              serviceId,
            });
            const allStaffSlots = await Promise.all(
              eligibleStaffIds.map(async (id) => {
                const stSlots = await getAvailableSlotsForStaff(supabase, {
                  tenantId: tenant.id,
                  staffId: id,
                  dateISO,
                  timezone: tenant.timezone,
                  combo,
                  slotIntervalMin: settings?.slot_interval_min ?? 15,
                  minNoticeMin: settings?.min_notice_min ?? 60,
                });
                return stSlots;
              })
            );

            const uniqueStarts = new Map<string, typeof allStaffSlots[0][0]>();
            for (const stSlots of allStaffSlots) {
               for (const slot of stSlots) {
                  uniqueStarts.set(slot.startsAt.toISOString(), slot);
               }
            }
            return Array.from(uniqueStarts.values()).sort((a,b) => a.startsAt.getTime() - b.startsAt.getTime());
          }

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

  const selectedService = servicesRes.data.find((s) => s.id === serviceId);
  const suggestedDeposit = (() => {
    if (!selectedService) return 0;
    const price = Number(selectedService.price);
    if (settings?.deposit_type === "percent") {
      return Math.max(Math.round((price * settings.deposit_value) / 100), settings.deposit_min);
    }
    if (settings?.deposit_type === "fixed") {
      return Math.max(settings.deposit_value, settings.deposit_min);
    }
    return 0;
  })();

  const closeHref = `/app/${tenantSlug}/agenda?date=${dateISO}`;

  return (
    // overflow-y-auto en el contenedor de afuera (no solo adentro de la
    // tarjeta): con el teclado del celular abierto, 100vh/fixed no se
    // achica, así que centrar con items-center dejaba la mitad de arriba
    // inalcanzable. items-start + scroll del contenedor entero lo evita.
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-on-surface/40 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
      <div className="relative my-6 w-full max-w-[30rem] animate-pop-in space-y-lg rounded-card border border-border bg-surface-container-lowest/85 p-xl shadow-card-hover backdrop-blur-xl sm:my-0">
        <Link
          href={closeHref}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
          aria-label="Cerrar"
        >
          <Icon name="close" className="text-[18px]" />
        </Link>

        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {rescheduleFrom ? "Reprogramar turno" : "Nuevo turno"}
          </h1>
          {rescheduleFrom && (
            <p className="mt-1 flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              {keepDeposit ? "Se mantiene la seña ya pagada del turno original." : "El turno nuevo arranca sin seña."}
            </p>
          )}
        </div>

        <form className="flex flex-col gap-3" method="GET">
          {rescheduleFrom && <input type="hidden" name="rescheduleFrom" value={rescheduleFrom} />}
          {rescheduleFrom && (
            <input type="hidden" name="keepDeposit" value={keepDeposit ? "true" : "false"} />
          )}
          {soloStaffId && <input type="hidden" name="staffId" value={soloStaffId} />}

          <ClientField tenantSlug={tenantSlug} clients={clientsRes.data} defaultClientId={clientId} />

          {!soloStaffId && (
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant">Profesional</label>
              <select
                name="staffId"
                defaultValue={staffId}
                required
                className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
              >
                <option value="" disabled>
                  Elegir…
                </option>
                <option value="any">Cualquiera</option>
                {staffRes.data.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          <Button type="submit" className="w-full">
            Ver horarios disponibles
          </Button>
        </form>

        {staffId && serviceId && clientId && (
          <SlotsAndDeposit
            tenantSlug={tenantSlug}
            staffId={staffId}
            clientId={clientId}
            serviceId={serviceId}
            dateISO={dateISO}
            slots={slots.map((slot) => ({
              startsAtISO: slot.startsAt.toISOString(),
              label: formatHour(slot.startsAt, tenant.timezone),
            }))}
            suggestedDeposit={suggestedDeposit}
            rescheduleFrom={rescheduleFrom}
            keepDeposit={keepDeposit}
          />
        )}
      </div>
      </div>
    </div>
  );
}
