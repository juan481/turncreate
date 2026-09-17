import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/server/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { cancelAppointmentAction } from "./actions";
import type { MiTurnoResult } from "../../types";

export default async function MiTurnoPage({
  params,
}: PageProps<"/[slug]/mi-turno/[token]">) {
  const { slug, token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_appointment_by_token", {
    p_token: token,
  });

  if (error || !data) {
    notFound();
  }

  const result = data as unknown as MiTurnoResult;
  const { appointment, client, staff, tenant, items } = result;

  if (tenant.slug !== slug) {
    notFound();
  }

  const isFuture = new Date(appointment.starts_at) > new Date();
  const canCancel = isFuture && (appointment.status === "confirmed" || appointment.status === "pending_payment");

  // Map appointment status to StatusPill status
  let statusColor: StatusPillStatus = "draft";
  let statusLabel = appointment.status;

  switch (appointment.status) {
    case "confirmed":
      statusColor = "confirmed";
      statusLabel = "Confirmado";
      break;
    case "pending_payment":
      statusColor = "pending";
      statusLabel = "Pago Pendiente";
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

  const startsAt = new Date(appointment.starts_at);
  const formattedDate = startsAt.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedTime = startsAt.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="container max-w-[42rem] py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Detalle de tu turno</h1>
        <p className="text-gray-500">
          En {tenant.name}
        </p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold capitalize">{formattedDate}</h2>
            <p className="text-3xl font-bold mt-2">{formattedTime}</p>
          </div>
          <StatusPill status={statusColor}>{statusLabel}</StatusPill>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Profesional</p>
            <p className="font-medium">{staff.display_name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="font-medium">{client.full_name}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500 mb-2">Servicios</p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">${item.price}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="font-medium text-gray-500">Total</span>
            <span className="text-xl font-bold">${appointment.total}</span>
          </div>

          {appointment.balance > 0 && (
            <div className="flex justify-between items-center text-red-600">
              <span className="font-medium">Saldo pendiente</span>
              <span className="font-bold">${appointment.balance}</span>
            </div>
          )}
        </div>
      </Card>

      {canCancel && (
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href={`/${slug}?rescheduleFrom=${appointment.id}`}
            className={cn(buttonVariants({ variant: "secondary" }), "flex-1")}
          >
            Reprogramar
          </Link>
          <form
            className="flex-1"
            action={cancelAppointmentAction.bind(null, token, slug)}
          >
            <Button variant="secondary" className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" type="submit">
              Cancelar Turno
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
