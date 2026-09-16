import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusActions } from "./status-actions";

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
       clients(id, full_name, phone_e164), staff(display_name),
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

  return (
    <div className="mx-auto max-w-lg space-y-lg">
      <Link
        href={`/app/${tenantSlug}/agenda?date=${dateISO}`}
        className="font-label-md text-label-md text-on-surface-variant"
      >
        ← Volver a la agenda
      </Link>

      <Card className="space-y-lg p-lg">
        <div className="flex items-center justify-between">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {formatHour(appointment.starts_at, tenant.timezone)}–
            {formatHour(appointment.ends_at, tenant.timezone)}
          </h1>
          <StatusPill status={status.pill}>{status.label}</StatusPill>
        </div>

        <div>
          <Link href={`/app/${tenantSlug}/clientes/${appointment.clients?.id}`} className="font-label-lg text-label-lg text-on-surface hover:underline">
            {appointment.clients?.full_name}
          </Link>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {appointment.clients?.phone_e164} · {appointment.staff?.display_name}
          </p>
        </div>

        <div className="space-y-1 rounded-inner bg-surface-muted p-3">
          {appointment.appointment_items.map((item) => (
            <div key={item.name} className="flex justify-between font-body-sm text-body-sm">
              <span className="text-on-surface">{item.name}</span>
              <span className="text-on-surface-variant">
                ${Number(item.price).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-1 font-label-md text-label-md text-on-surface">
            <span>Saldo</span>
            <span>${Number(appointment.balance).toLocaleString("es-AR")}</span>
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
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?rescheduleFrom=${appointment.id}&clientId=${appointment.clients?.id}`}
            className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-center")}
          >
            Reprogramar
          </Link>
        )}
      </Card>
    </div>
  );
}
