import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { addMonthsISO, monthLabel, monthRange, shortMonthLabel, toDateISOInTz, todayISO } from "@/lib/dates";
import { getTenantAnalyticsRange } from "@/server/analytics";
import { ReportesClient } from "./ReportesClient";

export default async function ReportesPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ month?: string }> }) {
  const { tenant: slug } = await params;
  const sp = await searchParams;
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return null;

  const currentMonthISO = todayISO(tenant.timezone).slice(0, 7);
  const monthISO = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : currentMonthISO;
  const monthFirstDay = `${monthISO}-01`;
  const previousMonthFirstDay = addMonthsISO(monthFirstDay, -1);
  const { start: monthStart, end: monthEnd } = monthRange(monthFirstDay, tenant.timezone);
  const { start: previousStart, end: previousEnd } = monthRange(previousMonthFirstDay, tenant.timezone);

  const db = firebaseAdmin().db;
  const ref = db.collection("tenants").doc(tenant.id);

  const [current, previousDocs, clients, staff, publicAnalytics] = await Promise.all([
    ref.collection("appointments").where("startsAt", ">=", monthStart).where("startsAt", "<", monthEnd).orderBy("startsAt").get(),
    ref.collection("appointments").where("startsAt", ">=", previousStart).where("startsAt", "<", previousEnd).get(),
    ref.collection("clients").get(),
    ref.collection("staff").where("active", "==", true).get(),
    getTenantAnalyticsRange({ tenantId: tenant.id, timezone: tenant.timezone, days: 14 }),
  ]);

  const completed = current.docs.map((doc) => doc.data()).filter((entry) => entry.status === "completed");

  // Definición única de "ingresos" en toda la pantalla: suma de `total` de
  // turnos completados (lo mismo que ya usa el gráfico de evolución mensual
  // de abajo y lo que el resto del sistema llama "facturado"). Antes el KPI
  // sumaba pagos aprobados y el gráfico sumaba `total` -- dos números que no
  // tenían por qué coincidir.
  const income = completed.reduce((sum, entry) => sum + Number(entry.total ?? 0), 0);

  // Servicios más pedidos: keyeado por `serviceId` (antes era por NOMBRE),
  // así el ranking se puede linkear a /servicios/{serviceId} desde el cliente.
  const services = new Map<string, { name: string; count: number; income: number }>();
  const people = new Map<string, { count: number; photo: string | null }>();
  for (const entry of completed) {
    for (const item of (entry.items ?? []) as { serviceId?: string; name?: string; price?: number }[]) {
      const id = item.serviceId ?? item.name ?? "";
      if (!id) continue;
      const prev = services.get(id) ?? { name: item.name ?? "Servicio", count: 0, income: 0 };
      services.set(id, { name: item.name ?? prev.name, count: prev.count + 1, income: prev.income + Number(item.price ?? 0) });
    }
    const name = String(entry.staffName ?? "");
    if (name) people.set(name, { count: (people.get(name)?.count ?? 0) + 1, photo: (entry.staffPhoto as string | null) ?? null });
  }
  const currentClients = new Set(completed.map((entry) => entry.clientId));
  const previousClients = new Set(previousDocs.docs.map((doc) => doc.data()).filter((entry) => entry.status === "completed").map((entry) => entry.clientId));
  const top = [...people.entries()].sort((a, b) => b[1].count - a[1].count)[0];

  // Egresos: salidas de caja de este mes (antes esto estaba hardcodeado en 0).
  const movementsSnapshots = await ref.collection("cashSessions").where("openedAt", ">=", monthStart).where("openedAt", "<", monthEnd).get();
  const outMovements = await Promise.all(movementsSnapshots.docs.map((doc) => doc.ref.collection("movements").where("type", "==", "out").get()));
  const egresos = outMovements.flatMap((snapshot) => snapshot.docs).reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0);

  // Un solo query de rango para los 6 meses en vez de 6 queries sueltos
  // (uno por mes) -- Firestore tiene una cuota dura de 60 operaciones/min
  // por proyecto que NO se puede pedir que suba (confirmado con Google:
  // "quotaIncreaseEligibility: NOT_SUPPORTED"), así que cada query de
  // más cuenta. El mes actual ya lo tenemos en `current`, no hace falta
  // volver a pedirlo.
  const evolutionStartISO = addMonthsISO(monthFirstDay, -5);
  const { start: evolutionStart } = monthRange(evolutionStartISO, tenant.timezone);
  const evolutionDocs =
    evolutionStartISO === monthFirstDay
      ? current.docs
      : [...(await ref.collection("appointments").where("startsAt", ">=", evolutionStart).where("startsAt", "<", monthStart).get()).docs, ...current.docs];
  const amountByMonth = new Map<string, number>();
  for (const doc of evolutionDocs) {
    const data = doc.data();
    if (data.status !== "completed" || !data.startsAt?.toDate) continue;
    const pointISO = toDateISOInTz(data.startsAt.toDate(), tenant.timezone).slice(0, 7);
    amountByMonth.set(pointISO, (amountByMonth.get(pointISO) ?? 0) + Number(data.total ?? 0));
  }
  const evolution = Array.from({ length: 6 }, (_, index) => {
    const monthOfPointISO = addMonthsISO(monthFirstDay, index - 5);
    return { label: shortMonthLabel(monthOfPointISO), amount: amountByMonth.get(monthOfPointISO.slice(0, 7)) ?? 0 };
  });

  const monthOptions = Array.from({ length: 12 }).map((_, index) => {
    const pointISO = addMonthsISO(`${currentMonthISO}-01`, -index);
    return { value: pointISO.slice(0, 7), label: monthLabel(pointISO) };
  });

  return (
    <div className="space-y-lg">
      {/* El AppBar mobile ya muestra "Reportes" + volver -- el <h1> de
          acá solo hace falta en el header-pill de desktop. El mes sigue
          visible en mobile, es contenido útil, no chrome de navegación. */}
      <div>
        <h1 className="hidden font-headline-lg-mobile text-headline-lg-mobile text-on-surface lg:block">Reportes</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant capitalize">{monthLabel(monthFirstDay)}</p>
      </div>
      <ReportesClient
        tenantSlug={slug}
        monthISO={monthISO}
        monthOptions={monthOptions}
        publicAnalytics={publicAnalytics}
        stats={{
          turnosRealizados: completed.length,
          clientesQueVinieron: currentClients.size,
          clientesNuevos: clients.docs.filter((doc) => {
            const created = doc.data().createdAt?.toDate?.();
            return created && created >= monthStart && created < monthEnd;
          }).length,
          clientesQueNoVolvieron: [...previousClients].filter((id) => !currentClients.has(id)).length,
          ingresos: income,
          egresos,
          ticketMasAlto: completed.reduce((max, entry) => Math.max(max, Number(entry.total ?? 0)), 0),
          serviciosPopulares: [...services.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5)
            .map(([id, data]) => ({ id, name: data.name, count: data.count, income: data.income })),
          evolucionMensual: evolution,
          profesionalDelMes: staff.size > 1 && top ? { name: top[0], count: top[1].count, photo: top[1].photo } : null,
        }}
      />
    </div>
  );
}
