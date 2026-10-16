import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { listAvailableStarts } from "@/server/firebase/booking";
import { addDaysISO, formatTimeInTz, isDateISO, todayISO } from "@/lib/dates";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { rescheduleBlockReason } from "@/domain/booking/reschedule";
import { TurnoForm } from "./turno-form";
import { resolveStaffId, type DepositRule, type ServiceOption, type StaffOption } from "./booking-rules";

export default async function NuevoTurnoPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/nuevo">) {
  const { tenant: tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantPage(tenantSlug);

  const firstDateISO = todayISO(tenant.timezone);
  const maxBookingDays = tenant.settings.maxBookingDays ?? 60;
  const lastDateISO = addDaysISO(firstDateISO, maxBookingDays);
  const requestedDate = typeof sp.date === "string" ? sp.date : "";
  // El día del que se vino (?date= de la agenda) es el día por defecto.
  const dateISO = isDateISO(requestedDate) && requestedDate >= firstDateISO && requestedDate <= lastDateISO ? requestedDate : firstDateISO;
  const clientId = typeof sp.clientId === "string" && sp.clientId ? sp.clientId : undefined;
  const rescheduleFrom = typeof sp.rescheduleFrom === "string" && sp.rescheduleFrom ? sp.rescheduleFrom : undefined;
  const keepDeposit = sp.keepDeposit !== "false";

  const { db } = firebaseAdmin();
  const [staffSnapshot, servicesSnapshot, clientsSnapshot, rescheduleSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("services").where("active", "==", true).get(),
    db.collection("tenants").doc(tenant.id).collection("clients").where("archivedAt", "==", null).get(),
    rescheduleFrom && /^[A-Za-z0-9_-]{1,64}$/.test(rescheduleFrom)
      ? db.collection("tenants").doc(tenant.id).collection("appointments").doc(rescheduleFrom).get()
      : null,
  ]);
  // ?rescheduleFrom= de un turno cancelado/vencido/esperando transferencia:
  // no se arma el formulario (la transacción lo rechazaría igual al final).
  const rescheduleBlocked = rescheduleFrom
    ? rescheduleBlockReason(rescheduleSnapshot?.exists ? rescheduleSnapshot.data() : null)
    : null;

  const staffList: StaffOption[] = staffSnapshot.docs.map((doc) => ({
    id: doc.id,
    displayName: String(doc.data().displayName),
    photoUrl: (doc.data().photoUrl as string | null) ?? null,
    serviceIds: Array.isArray(doc.data().serviceIds) ? (doc.data().serviceIds as unknown[]).map(String) : [],
  }));
  const servicesList: ServiceOption[] = servicesSnapshot.docs
    .filter((doc) => !doc.data().archivedAt)
    .map((doc) => ({ id: doc.id, name: String(doc.data().name), price: Number(doc.data().price) }));
  const clientsList = clientsSnapshot.docs.map((doc) => ({ id: doc.id, full_name: String(doc.data().fullName) }));

  // Servicio: el de la URL si sigue activo; con un solo servicio, ese.
  const requestedServiceId = typeof sp.serviceId === "string" ? sp.serviceId : "";
  const serviceId = servicesList.some((s) => s.id === requestedServiceId)
    ? requestedServiceId
    : servicesList.length === 1
      ? servicesList[0].id
      : "";
  // Profesional: misma regla que el stepper (booking-rules.ts) -- con uno
  // solo posible para el servicio se asigna directo.
  const requestedStaffId = typeof sp.staffId === "string" ? sp.staffId : undefined;
  const staffId = resolveStaffId(staffList, serviceId, requestedStaffId);

  const slots =
    staffId && serviceId
      ? await listAvailableStarts({ tenantId: tenant.id, tenant, serviceId, staffId, dateISO, timezone: tenant.timezone })
      : [];

  const depositRule: DepositRule = {
    type: tenant.settings.depositType ?? "none",
    value: Number(tenant.settings.depositValue ?? 0),
    min: Number(tenant.settings.depositMin ?? 0),
  };
  const openWeekdays = Array.from(new Set((tenant.businessHours ?? []).map((h) => h.weekday)));

  const closeHref = `/app/${tenantSlug}/agenda?date=${dateISO}`;

  return (
    // overflow-y-auto en el contenedor de afuera (no solo adentro de la
    // tarjeta): con el teclado del celular abierto, 100vh/fixed no se
    // achica, así que centrar con items-center dejaba la mitad de arriba
    // inalcanzable. items-start + scroll del contenedor entero lo evita.
    // z-[100] ya tapa el AppBar (z-40), así que arriba alcanza con el
    // safe-area; los márgenes chicos en mobile le dejan al calendario
    // columnas de ~40px aun en 320px.
    <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden overscroll-contain bg-on-surface/40 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center px-2 pb-[calc(1rem+var(--safe-b))] pt-[calc(0.75rem+var(--safe-t))] sm:items-center sm:p-4">
        <div className="relative w-full min-w-0 max-w-[30rem] animate-pop-in space-y-lg rounded-card border border-border bg-surface-container-lowest/95 p-md shadow-card-hover backdrop-blur-xl motion-reduce:animate-none sm:p-xl">
          <Link
            href={closeHref}
            className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:right-4 sm:top-4"
            aria-label="Cerrar"
          >
            <Icon name="close" className="text-[18px]" />
          </Link>

          <div className="min-w-0 pr-12">
            <h1 className="truncate font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              {rescheduleFrom ? "Reprogramar turno" : "Nuevo turno"}
            </h1>
            {rescheduleFrom && !rescheduleBlocked && (
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {keepDeposit ? "Se mantiene la seña ya pagada del turno original." : "El turno nuevo arranca sin seña."}
              </p>
            )}
          </div>

          {rescheduleBlocked ? (
            <div className="space-y-md">
              <p role="alert" className="flex items-start gap-2 rounded-inner bg-status-alert-bg px-3 py-2.5 font-body-sm text-body-sm text-status-alert">
                <Icon name="warning" className="mt-0.5 shrink-0 text-[16px]" />
                <span className="min-w-0">{rescheduleBlocked}</span>
              </p>
              <Link
                href={rescheduleSnapshot?.exists ? `/app/${tenantSlug}/agenda/${rescheduleFrom}` : closeHref}
                className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-center")}
              >
                {rescheduleSnapshot?.exists ? "Volver al turno" : "Volver a la agenda"}
              </Link>
            </div>
          ) : (
          <TurnoForm
            tenantSlug={tenantSlug}
            todayISO={firstDateISO}
            lastDateISO={lastDateISO}
            openWeekdays={openWeekdays}
            staffList={staffList}
            servicesList={servicesList}
            clientsList={clientsList}
            initialStaffId={staffId}
            initialServiceId={serviceId}
            initialClientId={clientId}
            initialDateISO={dateISO}
            slotsFor={{ serviceId, staffId, dateISO }}
            slots={slots.map((startsAt) => ({
              startsAtISO: startsAt.toISOString(),
              label: formatTimeInTz(startsAt, tenant.timezone),
            }))}
            depositRule={depositRule}
            rescheduleFrom={rescheduleFrom}
            keepDeposit={keepDeposit}
          />
          )}
        </div>
      </div>
    </div>
  );
}
