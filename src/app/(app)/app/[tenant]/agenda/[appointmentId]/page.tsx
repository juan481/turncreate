import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
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

function formatHour(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

export default async function AppointmentDetailPage({
  params,
}: PageProps<"/app/[tenant]/agenda/[appointmentId]">) {
  const { tenant: tenantSlug, appointmentId } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: appointment, error } = await supabase
    .from("appointments")
    .select(
      `id, status, starts_at, ends_at, total, deposit_paid, balance, cancel_reason,
       clients(id, full_name, phone_e164), staff(display_name, photo_url),
       appointment_items(name, price)`,
    )
    .eq("id", appointmentId)
    .eq("tenant_id", tenant.id)
    .single();

  if (error) throw error;

  const dateISO = appointment.starts_at.slice(0, 10);
  const status = STATUS_LABEL[appointment.status] ?? {
    label: appointment.status,
    pill: "pending" as StatusPillStatus,
  };
  const clientName = appointment.clients?.full_name ?? "";
  const phone = appointment.clients?.phone_e164 ?? "";
  const waLink = phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;
  const total = Number(appointment.total);
  const depositPaid = Number(appointment.deposit_paid);
  const balance = Number(appointment.balance);
  const durationMin = Math.round(
    (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000,
  );

  return (
    <div className="mx-auto max-w-[32rem] space-y-lg">
      <Link
        href={`/app/${tenantSlug}/agenda?date=${dateISO}`}
        className="inline-flex items-center gap-1 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[16px]" />
        Volver a la agenda
      </Link>

      <Card hoverLift={false} className="space-y-lg p-xl">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {formatHour(appointment.starts_at, tenant.timezone)} - {formatHour(appointment.ends_at, tenant.timezone)} hs
            </span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface">Detalle de Turno</h1>
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
            <Avatar name={clientName} size="lg" />
            <Link
              href={`/app/${tenantSlug}/clientes/${appointment.clients?.id}`}
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
              className="flex items-center justify-center gap-2 rounded-pill bg-surface-container-highest py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
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
              {appointment.appointment_items.map((i) => i.name).join(", ")}
            </span>
            <span className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{durationMin} min</span>
          </div>
          <div className="flex flex-col gap-1 rounded-inner bg-surface-container-low p-md">
            <span className="font-label-sm text-label-sm text-on-surface-variant">Especialista</span>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Avatar name={appointment.staff?.display_name ?? ""} src={appointment.staff?.photo_url} size="sm" />
              <span className="truncate font-label-lg text-label-lg text-on-surface">
                {appointment.staff?.display_name}
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

        {appointment.cancel_reason && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Motivo: {appointment.cancel_reason}
          </p>
        )}

        <StatusActions
          tenantSlug={tenantSlug}
          appointmentId={appointment.id}
          dateISO={dateISO}
          status={appointment.status}
        />

        {(appointment.status === "confirmed" || appointment.status === "pending_payment") && (
          <RescheduleButton
            tenantSlug={tenantSlug}
            appointmentId={appointment.id}
            clientId={appointment.clients?.id ?? ""}
            depositPaid={depositPaid}
          />
        )}
      </Card>
    </div>
  );
}
