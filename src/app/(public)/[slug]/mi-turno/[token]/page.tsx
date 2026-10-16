import { notFound } from "next/navigation";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getTransferInstructions } from "@/server/public-booking/transfer";
import { moneyLabel } from "@/server/public-booking/payment-methods";
import { formatInTz } from "@/lib/dates";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { cancelAppointmentAction } from "./actions";
import { TransferInstructions } from "../../transfer-instructions";
import { buildTransferPanel } from "../../transfer-panel";
import { publicCancelReason } from "./public-cancel-reason";

export default async function MiTurnoPage({
  params,
}: PageProps<"/[slug]/mi-turno/[token]">) {
  const { slug, token } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(token)) notFound();
  const tenant = await getTenantBySlugFromFirebase(slug);
  const result = await firebaseAdmin().db.collectionGroup("appointments").where("token", "==", token).limit(1).get();
  if (!tenant || result.empty || result.docs[0].data().tenantId !== tenant.id) notFound();
  const data = result.docs[0].data();
  const appointment = { id: result.docs[0].id, status: String(data.status), starts_at: data.startsAt?.toDate?.().toISOString?.() ?? "", ends_at: data.endsAt?.toDate?.().toISOString?.() ?? "", total: Number(data.total ?? 0), balance: Number(data.balance ?? 0) };
  const client = { full_name: String(data.clientName ?? "") };
  const staff = { display_name: String(data.staffName ?? "") };
  const items: { id: string; name: string; price: number }[] = (data.items ?? []).map((item: { name?: string; price?: number }, index: number) => ({ id: String(index), name: item.name ?? "Servicio", price: Number(item.price ?? data.total ?? 0) }));
  const awaitingTransfer = appointment.status === "pending_payment" && data.awaitingTransfer === true && data.source === "public_transfer";
  const transferInstructions = awaitingTransfer ? await getTransferInstructions(tenant, token) : null;
  const transferPanel = transferInstructions ? buildTransferPanel(tenant, slug, token, transferInstructions) : null;

  const isFuture = new Date(appointment.starts_at) > new Date();
  const canCancel = isFuture && (appointment.status === "confirmed" || appointment.status === "pending_payment");

  let statusColor: StatusPillStatus = "draft";
  let statusLabel = appointment.status;

  switch (appointment.status) {
    case "confirmed":
      statusColor = "confirmed";
      statusLabel = "Confirmado";
      break;
    case "pending_payment":
      statusColor = "pending";
      statusLabel = awaitingTransfer ? "Esperando transferencia" : "Pago pendiente";
      break;
    case "cancelled":
      statusColor = "alert";
      statusLabel = "Cancelado";
      break;
    case "no_show":
      statusColor = "alert";
      statusLabel = "Ausente";
      break;
    case "completed":
      statusColor = "confirmed";
      statusLabel = "Completado";
      break;
  }

  // Formateado en la zona del local, no la del servidor (el VPS corre en
  // UTC) ni la del navegador -- sin `timeZone` explícito se le mostraba al
  // cliente una hora distinta a la que realmente tiene el turno.
  const startsAt = new Date(appointment.starts_at);
  const formattedDate = formatInTz(startsAt, tenant.timezone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = formatInTz(startsAt, tenant.timezone, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const whatsappDigits = (tenant.whatsappNumber ?? "").replace(/\D/g, "");
  const rescheduleHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Hola, quiero reprogramar mi turno del ${formattedDate} a las ${formattedTime} en ${tenant.name}.`)}`
    : null;

  return (
    <div className="space-y-lg">
      {transferPanel && <TransferInstructions panel={transferPanel} showMiTurnoLink={false} />}

      <div className="min-w-0 space-y-1 px-1">
        {transferPanel ? (
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Detalle de tu turno</h2>
        ) : (
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Detalle de tu turno</h1>
        )}
        <p className="truncate font-body-md text-body-md text-on-surface-variant">En {tenant.name}</p>
      </div>

      <Card hoverLift={false} className="space-y-lg p-lg">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-headline-sm text-headline-sm text-on-surface first-letter:uppercase">{formattedDate}</p>
            <p className="mt-1 font-headline-xl-mobile text-headline-xl-mobile tabular-nums text-on-surface">{formattedTime}</p>
          </div>
          <StatusPill status={statusColor} className="shrink-0">{statusLabel}</StatusPill>
        </div>

        <div className="space-y-4">
          {staff.display_name && (
            <div className="min-w-0">
              <p className="font-label-md text-label-md text-on-surface-variant">Profesional</p>
              <p className="truncate font-label-lg text-label-lg text-on-surface">{staff.display_name}</p>
            </div>
          )}

          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface-variant">Cliente</p>
            <p className="truncate font-label-lg text-label-lg text-on-surface">{client.full_name}</p>
          </div>

          <div>
            <p className="mb-2 font-label-md text-label-md text-on-surface-variant">Servicios</p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 font-body-md text-body-md text-on-surface">
                  <span className="min-w-0 break-words">{item.name}</span>
                  <span className="shrink-0 tabular-nums">{moneyLabel(item.price)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="font-label-lg text-label-lg text-on-surface-variant">Total</span>
            <span className="font-headline-sm text-headline-sm tabular-nums text-on-surface">{moneyLabel(appointment.total)}</span>
          </div>

          {appointment.balance > 0 && appointment.status !== "cancelled" && (
            <div className="flex items-center justify-between text-status-pending">
              <span className="font-label-lg text-label-lg">Saldo pendiente</span>
              <span className="font-label-lg text-label-lg tabular-nums">{moneyLabel(appointment.balance)}</span>
            </div>
          )}

          {/* Solo un motivo fijo derivado de campos del sistema: el texto
              libre de la dueña (cancelReason) puede tener notas internas. */}
          {appointment.status === "cancelled" && (
            <p className="rounded-inner bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">
              {publicCancelReason(data)}
            </p>
          )}
        </div>
      </Card>

      {canCancel && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {rescheduleHref && (
            <a
              href={rescheduleHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:flex-1")}
            >
              Pedir reprogramación
            </a>
          )}
          <form
            className="sm:flex-1"
            action={cancelAppointmentAction.bind(null, token, slug)}
          >
            <Button variant="secondary" className="w-full text-status-alert" type="submit">
              Cancelar turno
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
