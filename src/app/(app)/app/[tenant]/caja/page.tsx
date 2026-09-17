import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { CajaClient } from "./caja-client";

export default async function CajaPage({
  params,
}: PageProps<"/app/[tenant]/caja">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const dateISO = new TZDate(new Date(), tenant.timezone).toISOString().slice(0, 10);
  const startUTC = new TZDate(`${dateISO}T00:00:00`, tenant.timezone).toISOString();
  const endUTC = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone).toISOString();

  const [sessionRes, appointmentsRes, productsRes] = await Promise.all([
    supabase
      .from("cash_sessions")
      .select("id, opened_at, opening_amount")
      .eq("tenant_id", tenant.id)
      .is("closed_at", null)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("id, starts_at, total, balance, clients(full_name), staff(display_name), appointment_items(name)")
      .eq("tenant_id", tenant.id)
      .eq("status", "confirmed")
      .gte("starts_at", startUTC)
      .lte("starts_at", endUTC)
      .order("starts_at"),
    supabase
      .from("products")
      .select("id, name, price")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("name"),
  ]);

  if (sessionRes.error) throw sessionRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;
  if (productsRes.error) throw productsRes.error;

  const session = sessionRes.data;

  const { data: sessionMovements } = session
    ? await supabase
        .from("cash_movements")
        .select("id, type, amount, reason, created_at")
        .eq("cash_session_id", session.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <CajaClient
      tenantSlug={tenantSlug}
      timezone={tenant.timezone}
      session={session}
      appointments={appointmentsRes.data.map((a) => ({
        id: a.id,
        startsAt: a.starts_at,
        total: Number(a.total),
        balance: Number(a.balance),
        clientName: a.clients?.full_name ?? "",
        staffName: a.staff?.display_name ?? "",
        serviceNames: a.appointment_items.map((i) => i.name).join(", "),
      }))}
      products={productsRes.data.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
      movements={(sessionMovements ?? []).map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        reason: m.reason,
      }))}
    />
  );
}
