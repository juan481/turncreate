import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { listAvailableStarts } from "@/server/firebase/booking";
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
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const dateISO =
    typeof sp.date === "string" ? sp.date : new TZDate(new Date(), tenant.timezone).toISOString().slice(0, 10);
  const serviceId = typeof sp.serviceId === "string" ? sp.serviceId : undefined;
  const clientId = typeof sp.clientId === "string" ? sp.clientId : undefined;
  const rescheduleFrom = typeof sp.rescheduleFrom === "string" ? sp.rescheduleFrom : undefined;
  const keepDeposit = sp.keepDeposit !== "false";

  const { db } = firebaseAdmin();
  const [staffSnapshot, servicesSnapshot, clientsSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("services").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("clients").where("archivedAt", "==", null).get(),
  ]);

  const staffList = staffSnapshot.docs.map((doc) => ({ id: doc.id, displayName: String(doc.data().displayName) }));
  const servicesList = servicesSnapshot.docs
    .filter((doc) => !doc.data().archivedAt)
    .map((doc) => ({ id: doc.id, name: String(doc.data().name), price: Number(doc.data().price) }));
  const clientsList = clientsSnapshot.docs.map((doc) => ({ id: doc.id, full_name: String(doc.data().fullName) }));

  // Con un solo profesional activo, preguntar "¿con quién?" es ruido --
  // se asigna directo y el selector ni se muestra.
  const soloStaffId = staffList.length === 1 ? staffList[0].id : undefined;
  const staffId = soloStaffId ?? (typeof sp.staffId === "string" ? sp.staffId : undefined);

  const slots =
    staffId && serviceId
      ? await listAvailableStarts({ tenantId: tenant.id, tenant, serviceId, staffId, dateISO, timezone: tenant.timezone })
      : [];

  const selectedService = servicesList.find((s) => s.id === serviceId);
  const settings = tenant.settings;
  const suggestedDeposit = (() => {
    if (!selectedService) return 0;
    const price = selectedService.price;
    if (settings?.depositType === "percent") {
      return Math.max(Math.round((price * settings.depositValue) / 100), settings.depositMin);
    }
    if (settings?.depositType === "fixed") {
      return Math.max(settings.depositValue, settings.depositMin);
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
      {/* pt-24 en mobile: el header flota fijo arriba y si no, tapa el
          título y el botón de cerrar de la tarjeta. */}
      <div className="flex min-h-full items-start justify-center p-4 pt-24 sm:items-center sm:pt-4">
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

          <ClientField tenantSlug={tenantSlug} clients={clientsList} defaultClientId={clientId} />

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
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
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
              {servicesList.map((s) => (
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
            slots={slots.map((startsAt) => ({
              startsAtISO: startsAt.toISOString(),
              label: formatHour(startsAt, tenant.timezone),
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
