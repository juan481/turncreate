import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type AppNotification = {
  id: string;
  icon: string;
  color: string;
  title: string;
  detail: string;
  at: string;
};

/**
 * Notificaciones reales derivadas de eventos que ya existen en la base
 * (no hay tabla de notificaciones propia todavía): turnos nuevos desde el
 * turnero público, cancelaciones recientes y stock bajo. Alcanza para
 * que el botón de la campana tenga un propósito genuino en vez de un
 * panel siempre vacío.
 */
export async function getRecentNotifications(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [newBookingsRes, cancelledRes, productsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, created_at, clients(full_name), appointment_items(name)")
      .eq("tenant_id", tenantId)
      .eq("source", "public")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("appointments")
      .select("id, updated_at, cancel_reason, clients(full_name)")
      .eq("tenant_id", tenantId)
      .eq("status", "cancelled")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id, name, low_stock_threshold, stock_movements(qty)")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .gt("low_stock_threshold", 0),
  ]);

  const notifications: AppNotification[] = [];

  for (const b of newBookingsRes.data ?? []) {
    notifications.push({
      id: `booking-${b.id}`,
      icon: "event_available",
      color: "#22C55E",
      title: "Turno nuevo desde el turnero",
      detail: `${b.clients?.full_name ?? "Un cliente"} · ${b.appointment_items.map((i) => i.name).join(", ")}`,
      at: b.created_at,
    });
  }

  for (const c of cancelledRes.data ?? []) {
    notifications.push({
      id: `cancel-${c.id}`,
      icon: "event_busy",
      color: "#EF4444",
      title: "Turno cancelado",
      detail: `${c.clients?.full_name ?? "Un cliente"}${c.cancel_reason ? ` · ${c.cancel_reason}` : ""}`,
      at: c.updated_at,
    });
  }

  for (const p of productsRes.data ?? []) {
    const stock = p.stock_movements.reduce((sum, m) => sum + m.qty, 0);
    if (stock <= p.low_stock_threshold) {
      notifications.push({
        id: `stock-${p.id}`,
        icon: "inventory_2",
        color: "#F59E0B",
        title: "Stock bajo",
        detail: `${p.name}: quedan ${stock} unidades`,
        at: new Date().toISOString(),
      });
    }
  }

  return notifications.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}
