import Link from "next/link";
import { notFound } from "next/navigation";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { formatTimeInTz, toDateISOInTz } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusActions } from "./status-actions";
import { RescheduleButton } from "./reschedule-button";

const STATUS_LABEL: Record<string, { label: string; pill: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente de pago", pill: "pending" },
  confirmed: { label: "Confirmado", pill: "confirmed" },
  completed: { label: "Completado", pill: "confirmed" },
  no_show: { label: "No vino", pill: "alert" },
  cancelled: { label: "Cancelado", pill: "alert" },
  expired: { label: "Vencido", pill: "alert" },
};

export default async function AppointmentDetailPage({
  params,
}: PageProps<"/app/[tenant]/agenda/[appointmentId]">) {
  const { tenant: tenantSlug, appointmentId } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) notFound();

  const { db } = firebaseAdmin();
  const appointmentDoc = await db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId).get();
  if (!appointmentDoc.exists) notFound();
  const appointment = appointmentDoc.data()!;

  const [staffDoc] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").doc(appointment.staffId).get(),
  ]);
  const staff = staffDoc.data();

  const startsAt: Date = appointment.startsAt.toDate();
  const endsAt: Date = appointment.endsAt.toDate();
  const dateISO = toDateISOInTz(startsAt, tenant.timezone);
  const status = STATUS_LABEL[appointment.status] ?? {
    label: appointment.status,
    pill: "pending" as StatusPillStatus,
  };
  const clientName = String(appointment.clientName ?? "");
  const clientPhoto = (appointment.clientPhoto as string | null | undefined) ?? null;
  const phone = String(appointment.clientPhone ?? "");
  const waLink = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;
  const total = Number(appointment.total);
  const depositPaid = Number(appointment.depositPaid ?? 0);
  const balance = Number(appointment.balance);
  const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);
  const items = (appointment.items ?? []) as { serviceId?: string; name: string }[];
  const originalServiceId = String(items[0]?.serviceId ?? "");
  const canCharge = balance > 0 && (appointment.status === "confirmed" || appointment.status === "pending_payment");

  return (
    <div className="mx-auto max-w-[32rem] space-y-lg">
      {/* En mobile el AppBar del shell ya da "‹ Agenda" -- este back propio
          (con el ?date= preciso del turno, más útil que el genérico del
          AppBar) solo hace falta en desktop, donde no hay AppBar. */}
      <Link
        href={`/app/${tenantSlug}/agenda?date=${dateISO}`}
        className="hidden items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface lg:inline-flex"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Volver a la agenda
      </Link>

      <Card hoverLift={false} className="space-y-lg p-xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {formatTimeInTz(startsAt, tenant.timezone)} - {formatTimeInTz(endsAt, tenant.timezone)} hs
            </span>
            {/* Mismo título que ya muestra el AppBar en mobile -- se oculta
                ahí para no duplicarlo, visible en desktop donde el
                header-pill no tiene título propio. */}
            <h1 className="hidden font-headline-sm text-headline-sm text-on-surface lg:block">Detalle de Turno</h1>
          </div>
          {appointment.status === "confirmed" ? (
            <span className="flex items-center gap-1.5 rounded-pill bg-status-confirmed-bg px-3 py-1 font-label-md text-label-md font-semibold text-status-confirmed">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-confirmed-dot opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-status-confirmed-dot" />
              </span>
              {status.label}
            </span>
          ) : (
            <StatusPill status={status.pill}>{status.label}</StatusPill>
          )}
        </div>

        {/* Cliente + contacto */}
        <div className="flex flex-col gap-md rounded-inner bg-surface-container-low p-lg">
          <div className="flex items-center gap-md">
            <Avatar name={clientName} src={clientPhoto} size="lg" />
            <Link
              href={`/app/${tenantSlug}/clientes/${appointment.clientId}`}
              className="font-headline-sm text-headline-sm text-on-surface hover:underline"
            >
              {clientName}
            </Link>
          </div>
          <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <Icon name="call" className="text-[16px]" />
              {phone}
            </span>
          </div>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener"
              // h-11 (44px), no py-2: py-2 solo + el alto de línea del texto
              // quedaba debajo del mínimo tocable.
              className="flex h-11 items-center justify-center gap-2 rounded-pill bg-surface-container-highest font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <Icon name="chat" className="text-[18px] text-status-confirmed" />
              Abrir chat WhatsApp
              <Icon name="north_east" className="text-[14px]" />
            </a>
          )}
        </div>

        {/* Servicio + especialista */}
        <div className="grid grid-cols-2 gap-sm">
          <div className="flex flex-col gap-1 rounded-inner bg-surface-container-low p-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Servicio</span>
            <span className="font-label-lg text-label-lg leading-snug text-on-surface">
              {items.map((i) => i.name).join(", ")}
            </span>
            <span className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{durationMin} min</span>
          </div>
          <div className="flex flex-col gap-1 rounded-inner bg-surface-container-low p-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Especialista</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Avatar name={String(staff?.displayName ?? "")} src={staff?.photoUrl ?? null} size="sm" />
              <span className="truncate font-label-lg text-label-lg text-on-surface">
                {staff?.displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Desglose financiero */}
        <div className="flex flex-col gap-sm rounded-inner bg-surface-container p-lg">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant">Total del turno</span>
            <span className="font-label-lg text-label-lg font-semibold text-on-surface">
              ${total.toLocaleString("es-AR")}
            </span>
          </div>
          {depositPaid > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant">
                Seña abonada
                <Icon name="check_circle" className="text-[16px] text-status-confirmed" />
              </span>
              <span className="font-label-md text-label-md font-semibold text-status-confirmed">
                - ${depositPaid.toLocaleString("es-AR")}
              </span>
            </div>
          )}
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="font-headline-sm text-headline-sm text-on-surface">Saldo a cobrar</span>
            <span className="font-headline-sm text-headline-sm text-secondary">
              {balance > 0 ? `$${balance.toLocaleString("es-AR")}` : "Pagado"}
            </span>
          </div>
        </div>

        {appointment.cancelReason && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Motivo: {appointment.cancelReason}
          </p>
        )}
        {appointment.note && <div className="rounded-inner bg-surface-container-low p-md"><p className="font-label-sm text-label-sm text-on-surface-variant">Nota del turno</p><p className="mt-1 whitespace-pre-wrap break-words font-body-md text-body-md text-on-surface">{String(appointment.note)}</p></div>}

        {/* Cobrar: el flujo real de cobro vive en /caja (abre/cierra caja,
            suma productos, elige método) -- esa pantalla no acepta todavía
            un appointmentId por query param para abrir directo el cobro de
            ESTE turno (está fuera de este alcance, vive en caja/**), así
            que por ahora el botón lleva a la pantalla de Caja a secas. */}
        {canCharge && (
          <Link
            href={`/app/${tenantSlug}/caja`}
            className={cn(buttonVariants({ size: "default" }), "w-full justify-center")}
          >
            <Icon name="payments" className="text-[18px]" />
            Cobrar ${balance.toLocaleString("es-AR")}
          </Link>
        )}

        <StatusActions
          tenantSlug={tenantSlug}
          appointmentId={appointmentDoc.id}
          dateISO={dateISO}
          status={appointment.status}
          depositPaid={depositPaid}
        />

        {(appointment.status === "confirmed" || appointment.status === "pending_payment") && (
          <RescheduleButton
            tenantSlug={tenantSlug}
            appointmentId={appointmentDoc.id}
            clientId={String(appointment.clientId ?? "")}
            serviceId={originalServiceId}
            staffId={String(appointment.staffId ?? "")}
            dateISO={dateISO}
            depositPaid={depositPaid}
          />
        )}
      </Card>
    </div>
  );
}
