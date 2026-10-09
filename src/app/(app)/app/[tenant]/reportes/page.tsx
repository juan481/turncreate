import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { addMonthsISO, monthLabel, monthRange, shortMonthLabel, todayISO } from "@/lib/dates";
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

  const [current, previousDocs, clients, staff] = await Promise.all([
    ref.collection("appointments").where("startsAt", ">=", monthStart).where("startsAt", "<", monthEnd).orderBy("startsAt").get(),
    ref.collection("appointments").where("startsAt", ">=", previousStart).where("startsAt", "<", previousEnd).get(),
    ref.collection("clients").get(),
    ref.collection("staff").where("active", "==", true).get(),
  ]);

  const completed = current.docs.map((doc) => doc.data()).filter((entry) => entry.status === "completed");
  const payments = await Promise.all(
    completed.map((entry) => ref.collection("appointments").doc(entry.id as string).collection("payments").where("status", "==", "approved").get()),
  );

  const services = new Map<string, number>();
  const people = new Map<string, { count: number; photo: string | null }>();
  for (const entry of completed) {
    for (const item of (entry.items ?? []) as { name?: string }[]) {
      services.set(item.name ?? "", (services.get(item.name ?? "") ?? 0) + 1);
    }
    const name = String(entry.staffName ?? "");
    if (name) people.set(name, { count: (people.get(name)?.count ?? 0) + 1, photo: (entry.staffPhoto as string | null) ?? null });
  }
  const income = payments.flatMap((snapshot) => snapshot.docs).reduce((sum, payment) => sum + Number(payment.data().amount ?? 0), 0);
  const currentClients = new Set(completed.map((entry) => entry.clientId));
  const previousClients = new Set(previousDocs.docs.map((doc) => doc.data()).filter((entry) => entry.status === "completed").map((entry) => entry.clientId));
  const top = [...people.entries()].sort((a, b) => b[1].count - a[1].count)[0];

  // Egresos: salidas de caja de este mes (antes esto estaba hardcodeado en 0).
  const movementsSnapshots = await ref.collection("cashSessions").where("openedAt", ">=", monthStart).where("openedAt", "<", monthEnd).get();
  const outMovements = await Promise.all(movementsSnapshots.docs.map((doc) => doc.ref.collection("movements").where("type", "==", "out").get()));
  const egresos = outMovements.flatMap((snapshot) => snapshot.docs).reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0);

  const evolution = await Promise.all(
    Array.from({ length: 6 }).map(async (_, index) => {
      const monthOfPointISO = addMonthsISO(monthFirstDay, index - 5);
      const { start, end } = monthRange(monthOfPointISO, tenant.timezone);
      const docs = await ref.collection("appointments").where("startsAt", ">=", start).where("startsAt", "<", end).get();
      return {
        label: shortMonthLabel(monthOfPointISO),
        amount: docs.docs.filter((doc) => doc.data().status === "completed").reduce((sum, doc) => sum + Number(doc.data().total ?? 0), 0),
      };
    }),
  );

  const monthOptions = Array.from({ length: 12 }).map((_, index) => {
    const pointISO = addMonthsISO(`${currentMonthISO}-01`, -index);
    return { value: pointISO.slice(0, 7), label: monthLabel(pointISO) };
  });

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Reportes</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant capitalize">{monthLabel(monthFirstDay)}</p>
      </div>
      <ReportesClient
        tenantSlug={slug}
        monthISO={monthISO}
        monthOptions={monthOptions}
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
          serviciosPopulares: [...services.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
          evolucionMensual: evolution,
          profesionalDelMes: staff.size > 1 && top ? { name: top[0], count: top[1].count, photo: top[1].photo } : null,
        }}
      />
    </div>
  );
}
