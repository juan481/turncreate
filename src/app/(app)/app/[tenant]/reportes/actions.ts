"use server";

import { startOfMonth, endOfMonth } from "date-fns";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";

export async function exportarTurnosCsv(tenantSlug: string, monthISO: string) {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const monthDate = new Date(`${monthISO}-01T12:00:00`);
  const monthStart = startOfMonth(monthDate).toISOString();
  const monthEnd = endOfMonth(monthDate).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("starts_at, status, total, clients(full_name), appointment_items(name)")
    .eq("tenant_id", tenant.id)
    .gte("starts_at", monthStart)
    .lte("starts_at", monthEnd)
    .order("starts_at");

  if (error) throw error;

  const STATUS_LABEL: Record<string, string> = {
    pending_payment: "Pendiente de pago",
    confirmed: "Confirmado",
    completed: "Completado",
    no_show: "No vino",
    cancelled: "Cancelado",
    expired: "Vencido",
  };

  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = "Fecha,Cliente,Servicio,Estado,Monto\n";
  const rows = data.map((a) =>
    [
      escape(new Date(a.starts_at).toLocaleString("es-AR")),
      escape(a.clients?.full_name ?? ""),
      escape(a.appointment_items.map((i) => i.name).join(" + ")),
      escape(STATUS_LABEL[a.status] ?? a.status),
      Number(a.total).toFixed(2),
    ].join(","),
  );

  return {
    filename: `turnos-${tenantSlug}-${monthISO}.csv`,
    content: header + rows.join("\n"),
  };
}
