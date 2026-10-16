import Link from "next/link";
import { notFound } from "next/navigation";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { formatInTz, formatTimeInTz, toDateISOInTz } from "@/lib/dates";
import { isRefundDue } from "@/server/firebase/stats-model";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusActions } from "./status-actions";
import { RescheduleButton } from "./reschedule-button";
import { RefundButton } from "./refund-button";
import { TransferDecision } from "../../transferencias/transfer-decision";
import { moneyLabel, transferTimeLeftLabel } from "@/server/public-booking/payment-methods";

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
  const { tenant } = await requireTenantPage(tenantSlug);

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
  // Seña por transferencia del turnero público esperando el comprobante:
  // en vez de "Registrar pago"/"Cobrar"/"Reprogramar" se muestran las dos
  // acciones de la transferencia (confirmar o rechazar).
  const awaitingTransfer = appointment.status === "pending_payment" && appointment.awaitingTransfer === true;
  const transferExpiresAt: Date | null = appointment.transferExpiresAt?.toDate?.() ?? null;
  const depositDue = Number(appointment.depositDue ?? 0);
  const canCharge = !awaitingTransfer && balance > 0 && (appointment.status === "confirmed" || appointment.status === "pending_payment");
  // Mismo criterio que "A devolver" en Caja/Reportes (stats-model.ts).
  const refundDue = isRefundDue(appointment);
  const depositRefunded = appointment.status === "cancelled" && appointment.depositRefunded === true;
  // Reservas por transferencia sin confirmar todavía no tienen ficha (se
  // arma al confirmar la seña): el nombre se muestra sin link.
  const clientId = typeof appointment.clientId === "string" && appointment.clientId ? appointment.clientId : null;

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
            {clientId ? (
              <Link
                href={`/app/${tenantSlug}/clientes/${clientId}`}
                className="min-w-0 truncate font-headline-sm text-headline-sm text-on-surface hover:underline"
              >
                {clientName}
              </Link>
            ) : (
              <span className="min-w-0 truncate font-headline-sm text-headline-sm text-on-surface">{clientName}</span>
            )}
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
        {refundDue && (
          <div className="space-y-md rounded-inner border border-status-alert/30 bg-status-alert-bg p-lg">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-status-alert">
                <Icon name="warning" className="text-[20px]" />
              </span>
              <div className="min-w-0">
                <p className="font-label-lg text-label-lg text-on-surface">Seña a devolver</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Cancelaste este turno y elegiste devolver la seña de <strong className="tabular-nums text-on-surface">{moneyLabel(depositPaid)}</strong>. Cuando se la devuelvas, marcala acá para que deje de figurar en &ldquo;A devolver&rdquo;.
                </p>
              </div>
            </div>
            <RefundButton tenantSlug={tenantSlug} appointmentId={appointmentDoc.id} amountLabel={moneyLabel(depositPaid)} />
          </div>
        )}
        {depositRefunded && (
          <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="check_circle" className="text-[16px] text-status-confirmed" />
            Seña devuelta
            {appointment.depositRefundedAt?.toDate ? ` el ${formatInTz(appointment.depositRefundedAt.toDate(), tenant.timezone, { day: "numeric", month: "numeric" })}` : ""}
          </p>
        )}
        {appointment.note &&<div className="rounded-inner bg-surface-container-low p-md"><p className="font-label-sm text-label-sm text-on-surface-variant">Nota del turno</p><p className="mt-1 whitespace-pre-wrap break-words font-body-md text-body-md text-on-surface">{String(appointment.note)}</p></div>}

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

        {awaitingTransfer ? (
          <div className="space-y-md rounded-inner border border-status-pending/30 bg-status-pending-bg p-lg">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-status-pending">
                <Icon name="hourglass_top" className="text-[20px]" />
              </span>
              <div className="min-w-0">
                <p className="font-label-lg text-label-lg text-on-surface">Esperando transferencia</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Reservó desde tu link y eligió transferir la seña de <strong className="tabular-nums text-on-surface">{moneyLabel(depositDue)}</strong>. Confirmala cuando veas el comprobante.
                </p>
                {transferExpiresAt && (
                  <p className="mt-1 font-label-md text-label-md text-status-pending">
                    {transferTimeLeftLabel(transferExpiresAt)} · si no la confirmás, se cancela sola
                  </p>
                )}
              </div>
            </div>
            <TransferDecision tenantSlug={tenantSlug} appointmentId={appointmentDoc.id} amountLabel={moneyLabel(depositDue)} />
          </div>
        ) : (
          <StatusActions
            tenantSlug={tenantSlug}
            appointmentId={appointmentDoc.id}
            dateISO={dateISO}
            status={appointment.status}
            depositPaid={depositPaid}
          />
        )}

        {!awaitingTransfer && (appointment.status === "confirmed" || appointment.status === "pending_payment") && (
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
