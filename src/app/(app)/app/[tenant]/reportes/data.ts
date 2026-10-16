import "server-only";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantAnalyticsRange } from "@/server/analytics";
import type { AnalyticsRange } from "@/server/analytics/types";
import { getPaymentBreakdown } from "@/server/firebase/stats";
import {
  summarizeAppointments,
  summarizeCompleted,
  type AppointmentTotals,
  type CompletedSummary,
  type PaymentBreakdown,
} from "@/server/firebase/stats-model";
import { addMonthsISO, monthRange, shortMonthLabel, toDateISOInTz } from "@/lib/dates";

export type CurrentMonth = { completed: CompletedSummary; totals: AppointmentTotals };
export type Evolution = {
  /** Facturado (total de completados) por "YYYY-MM", solo de los 5 meses ANTERIORES al elegido. */
  amountByMonth: Map<string, number>;
  /** Clientes con algún turno completado el mes anterior al elegido. */
  previousMonthClientIds: Set<string>;
};

export type ReportesData = {
  monthISO: string;
  /** Los 6 puntos del gráfico ("YYYY-MM-01"), del más viejo al elegido. */
  evolutionMonths: string[];
  current: Promise<CurrentMonth>;
  evolution: Promise<Evolution>;
  newClients: Promise<number>;
  activeStaff: Promise<number>;
  payments: Promise<PaymentBreakdown>;
  egresos: Promise<number>;
  analytics: Promise<AnalyticsRange>;
};

// Cada sección espera solo lo suyo; si una falla y la página corta, el
// resto de las promesas no queda como "unhandled rejection" en el proceso.
function observed<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}

/**
 * Arranca TODAS las lecturas de Reportes en paralelo (sin await) y devuelve
 * las promesas: cada sección de la página espera la suya dentro de su
 * propio <Suspense>, así lo que llega primero se ve primero.
 *
 * Lecturas (antes → ahora):
 * - clientes nuevos: toda la colección `clients` → un `count()` sobre el
 *   rango de `createdAt` (1 lectura cada 1000 entradas de índice).
 * - mes anterior: una query aparte → sale de la de evolución (5 meses), que
 *   ya lo incluía.
 * - staff activo: los docs → `count()`.
 * - turnos: `.select()` con solo los campos que se usan.
 * - egresos: sesiones del mes + movimientos en paralelo, sin esperar al
 *   resto de la página.
 */
export function loadReportes(tenant: { id: string; timezone: string }, monthISO: string): ReportesData {
  const tz = tenant.timezone;
  const monthFirstDay = `${monthISO}-01`;
  const month = monthRange(monthFirstDay, tz);
  const evolutionStart = monthRange(addMonthsISO(monthFirstDay, -5), tz).start;
  const previousMonthKey = addMonthsISO(monthFirstDay, -1).slice(0, 7);
  const evolutionMonths = Array.from({ length: 6 }, (_, index) => addMonthsISO(monthFirstDay, index - 5));

  const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id);
  const appointments = ref.collection("appointments");

  const current = appointments
    .where("startsAt", ">=", month.start)
    .where("startsAt", "<", month.end)
    .orderBy("startsAt")
    .select("status", "total", "balance", "clientId", "items", "staffName", "staffPhoto")
    .get()
    .then((snapshot) => {
      const docs = snapshot.docs.map((doc) => doc.data());
      return { completed: summarizeCompleted(docs), totals: summarizeAppointments(docs) };
    });

  const evolution = appointments
    .where("startsAt", ">=", evolutionStart)
    .where("startsAt", "<", month.start)
    .select("status", "total", "startsAt", "clientId")
    .get()
    .then((snapshot) => {
      const amountByMonth = new Map<string, number>();
      const previousMonthClientIds = new Set<string>();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.status !== "completed" || !data.startsAt?.toDate) continue;
        const key = toDateISOInTz(data.startsAt.toDate(), tz).slice(0, 7);
        amountByMonth.set(key, (amountByMonth.get(key) ?? 0) + Number(data.total ?? 0));
        if (key === previousMonthKey && typeof data.clientId === "string" && data.clientId) previousMonthClientIds.add(data.clientId);
      }
      return { amountByMonth, previousMonthClientIds };
    });

  const newClients = ref.collection("clients")
    .where("createdAt", ">=", month.start)
    .where("createdAt", "<", month.end)
    .count()
    .get()
    .then((snapshot) => snapshot.data().count);

  const activeStaff = ref.collection("staff").where("active", "==", true).count().get().then((snapshot) => snapshot.data().count);

  // Egresos: salidas de caja de las sesiones abiertas este mes. Los
  // movimientos de cada sesión se piden todos juntos (no uno tras otro).
  const egresos = ref.collection("cashSessions")
    .where("openedAt", ">=", month.start)
    .where("openedAt", "<", month.end)
    .select()
    .get()
    .then((sessions) => Promise.all(sessions.docs.map((doc) => doc.ref.collection("movements").where("type", "==", "out").select("amount").get())))
    .then((snapshots) => snapshots.flatMap((snapshot) => snapshot.docs).reduce((sum, doc) => sum + Number(doc.data().amount ?? 0), 0));

  return {
    monthISO,
    evolutionMonths,
    current: observed(current),
    evolution: observed(evolution),
    newClients: observed(newClients),
    activeStaff: observed(activeStaff),
    payments: observed(getPaymentBreakdown(tenant.id, month)),
    egresos: observed(egresos),
    analytics: observed(getTenantAnalyticsRange({ tenantId: tenant.id, timezone: tz, days: 14 })),
  };
}

/** Serie de 6 meses para el gráfico: 5 anteriores (query de evolución) + el elegido (query del mes). */
export function evolutionSeries(months: readonly string[], evolution: Evolution, current: CurrentMonth) {
  const last = months.length - 1;
  return months.map((monthFirstDay, index) => ({
    label: shortMonthLabel(monthFirstDay),
    value: index === last ? current.completed.income : evolution.amountByMonth.get(monthFirstDay.slice(0, 7)) ?? 0,
  }));
}
