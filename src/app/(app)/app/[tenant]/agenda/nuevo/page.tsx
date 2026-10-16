import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { listAvailableStarts } from "@/server/firebase/booking";
import { addDaysISO, formatTimeInTz, isDateISO, todayISO } from "@/lib/dates";
import { Icon } from "@/components/ui/icon";
import { TurnoForm } from "./turno-form";

export default async function NuevoTurnoPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/nuevo">) {
  const { tenant: tenantSlug } = await params;
  const sp = await searchParams;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const firstDateISO = todayISO(tenant.timezone);
  const maxBookingDays = tenant.settings.maxBookingDays ?? 60;
  const lastDateISO = addDaysISO(firstDateISO, maxBookingDays);
  const requestedDate = typeof sp.date === "string" ? sp.date : "";
  const dateISO = isDateISO(requestedDate) && requestedDate >= firstDateISO && requestedDate <= lastDateISO ? requestedDate : firstDateISO;
  const serviceId = typeof sp.serviceId === "string" && sp.serviceId ? sp.serviceId : undefined;
  const clientId = typeof sp.clientId === "string" && sp.clientId ? sp.clientId : undefined;
  const rescheduleFrom = typeof sp.rescheduleFrom === "string" ? sp.rescheduleFrom : undefined;
  const keepDeposit = sp.keepDeposit !== "false";

  const { db } = firebaseAdmin();
  const [staffSnapshot, servicesSnapshot, clientsSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("services").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("clients").where("archivedAt", "==", null).get(),
  ]);

  const staffList = staffSnapshot.docs.map((doc) => ({
    id: doc.id,
    displayName: String(doc.data().displayName),
    photoUrl: (doc.data().photoUrl as string | null) ?? null,
  }));
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

        <TurnoForm
          tenantSlug={tenantSlug}
          timezone={tenant.timezone}
          staffList={staffList}
          servicesList={servicesList}
          clientsList={clientsList}
          soloStaffId={soloStaffId}
          initialStaffId={staffId}
          initialServiceId={serviceId}
          initialClientId={clientId}
          initialDateISO={dateISO}
          maxBookingDays={maxBookingDays}
          slots={slots.map((startsAt) => ({
            startsAtISO: startsAt.toISOString(),
            label: formatTimeInTz(startsAt, tenant.timezone),
          }))}
          suggestedDeposit={suggestedDeposit}
          rescheduleFrom={rescheduleFrom}
          keepDeposit={keepDeposit}
        />
      </div>
      </div>
    </div>
  );
}
