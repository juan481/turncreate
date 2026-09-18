import { TZDate } from "@date-fns/tz";
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { ReportesClient } from "./ReportesClient";

async function getMonthRevenue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  monthDate: Date,
) {
  const start = startOfMonth(monthDate).toISOString();
  const end = endOfMonth(monthDate).toISOString();
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .gte("created_at", start)
    .lte("created_at", end);
  return (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
}

export default async function ReportesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const now = new TZDate(new Date(), tenant.timezone);
  const monthISO = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : format(now, "yyyy-MM");
  const monthDate = new Date(`${monthISO}-01T12:00:00`);
  const prevMonthDate = addMonths(monthDate, -1);

  const monthStart = startOfMonth(monthDate).toISOString();
  const monthEnd = endOfMonth(monthDate).toISOString();
  const prevMonthStart = startOfMonth(prevMonthDate).toISOString();
  const prevMonthEnd = endOfMonth(prevMonthDate).toISOString();

  const [
    completedRes,
    prevCompletedRes,
    newClientsRes,
    paymentsRes,
    egresosRes,
    lastSixMonthsRevenue,
    staffCountRes,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, client_id, total, staff(display_name, photo_url), appointment_items(name)")
      .eq("tenant_id", tenant.id)
      .eq("status", "completed")
      .gte("starts_at", monthStart)
      .lte("starts_at", monthEnd),
    supabase
      .from("appointments")
      .select("client_id")
      .eq("tenant_id", tenant.id)
      .eq("status", "completed")
      .gte("starts_at", prevMonthStart)
      .lte("starts_at", prevMonthEnd),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    supabase
      .from("payments")
      .select("amount")
      .eq("tenant_id", tenant.id)
      .eq("status", "approved")
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    supabase
      .from("cash_movements")
      .select("amount, cash_sessions!inner(tenant_id)")
      .eq("type", "out")
      .eq("cash_sessions.tenant_id", tenant.id)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    Promise.all(
      Array.from({ length: 6 }).map(async (_, i) => {
        const d = addMonths(monthDate, -(5 - i));
        return { label: format(d, "MMM", { locale: es }), amount: await getMonthRevenue(supabase, tenant.id, d) };
      }),
    ),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("active", true),
  ]);

  if (completedRes.error) throw completedRes.error;
  if (prevCompletedRes.error) throw prevCompletedRes.error;
  if (newClientsRes.error) throw newClientsRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (egresosRes.error) throw egresosRes.error;
  const hasMultipleStaff = (staffCountRes.count ?? 0) > 1;

  const completed = completedRes.data;
  const turnosRealizados = completed.length;
  const clientesQueVinieron = new Set(completed.map((a) => a.client_id)).size;
  const clientesNuevos = newClientsRes.count ?? 0;

  const clientesMesAnterior = new Set(prevCompletedRes.data.map((a) => a.client_id));
  const clientesMesActual = new Set(completed.map((a) => a.client_id));
  const clientesQueNoVolvieron = [...clientesMesAnterior].filter((id) => !clientesMesActual.has(id)).length;

  const ingresos = paymentsRes.data.reduce((sum, p) => sum + Number(p.amount), 0);
  const egresos = egresosRes.data.reduce((sum, m) => sum + Number(m.amount), 0);
  const ticketMasAlto = completed.reduce((max, a) => Math.max(max, Number(a.total)), 0);

  const serviceCounts = new Map<string, number>();
  for (const appt of completed) {
    for (const item of appt.appointment_items) {
      serviceCounts.set(item.name, (serviceCounts.get(item.name) ?? 0) + 1);
    }
  }
  const serviciosPopulares = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const staffCounts = new Map<string, { count: number; photo: string | null }>();
  for (const appt of completed) {
    const name = appt.staff?.display_name;
    if (!name) continue;
    const current = staffCounts.get(name) ?? { count: 0, photo: appt.staff?.photo_url ?? null };
    staffCounts.set(name, { count: current.count + 1, photo: current.photo });
  }
  const topStaffEntry = [...staffCounts.entries()].sort((a, b) => b[1].count - a[1].count)[0];
  const profesionalDelMes = hasMultipleStaff && topStaffEntry
    ? { name: topStaffEntry[0], count: topStaffEntry[1].count, photo: topStaffEntry[1].photo }
    : null;

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = addMonths(now, -i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: es }) };
  });

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Reportes</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant capitalize">
          {format(monthDate, "MMMM yyyy", { locale: es })}
        </p>
      </div>

      <ReportesClient
        tenantSlug={tenantSlug}
        monthISO={monthISO}
        monthOptions={monthOptions}
        stats={{
          turnosRealizados,
          clientesQueVinieron,
          clientesNuevos,
          clientesQueNoVolvieron,
          ingresos,
          egresos,
          ticketMasAlto,
          serviciosPopulares,
          evolucionMensual: lastSixMonthsRevenue,
          profesionalDelMes,
        }}
      />
    </div>
  );
}
