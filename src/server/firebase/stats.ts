import "server-only";
import { firebaseAdmin } from "./admin";
import { dayRange } from "@/lib/dates";

export type DayAppointment = {
  id: string;
  startsAt: string;
  status: string;
  total: number;
  balance: number;
  clientId: string;
  clientName: string;
  clientPhoto: string | null;
  staffId: string;
  staffName: string;
  staffPhoto: string | null;
  serviceNames: string;
};

export type DaySummary = {
  dateISO: string;
  appointments: DayAppointment[];
  turnos: number;
  facturado: number;
  cobrado: number;
  porCobrar: number;
};

export type RangeSummary = {
  turnos: number;
  facturado: number;
  cobrado: number;
  porCobrar: number;
};

export type PaymentSummary = { gross: number; applied: number; fees: number; surcharges: number; net: number; count: number };

export async function getPaymentSummary(tenantId: string, range: { start: Date; end: Date }): Promise<PaymentSummary> {
  const snapshot = await firebaseAdmin().db.collectionGroup("payments")
    .where("tenantId", "==", tenantId)
    .where("paidAt", ">=", range.start)
    .where("paidAt", "<", range.end)
    .get();
  return snapshot.docs.reduce<PaymentSummary>((summary, doc) => {
    const data = doc.data();
    if (data.status !== "approved") return summary;
    summary.gross += Number(data.grossAmount ?? data.amount ?? 0);
    summary.applied += Number(data.appliedAmount ?? data.amount ?? 0);
    summary.fees += Number(data.feeAmount ?? 0);
    summary.surcharges += Number(data.surchargeAmount ?? 0);
    summary.net += Number(data.netAmount ?? data.amount ?? 0);
    summary.count += 1;
    return summary;
  }, { gross: 0, applied: 0, fees: 0, surcharges: 0, net: 0, count: 0 });
}

// Mismos estados en todos lados: cancelado y vencido nunca suman turno,
// nunca suman plata. Antes cada pantalla (home, Caja, agenda) traía los
// turnos del día con su propio criterio -- ninguno filtraba por estado,
// así que un turno cancelado podía aparecer en la lista Y sumar a "a
// cobrar hoy" en más de un lado.
const ACTIVE_STATUSES = new Set(["confirmed", "completed"]);

/**
 * Turnos activos de un día + los totales que de ahí se derivan
 * (facturado = suma de `total`, cobrado = facturado - balance, por
 * cobrar = suma de `balance`). Única fuente de verdad para que Home,
 * Caja y Reportes no muestren números distintos para "lo mismo".
 */
export async function getDaySummary(tenantId: string, dateISO: string, timezone: string): Promise<DaySummary> {
  const { start, end } = dayRange(dateISO, timezone);
  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const snapshot = await tenantRef
    .collection("appointments")
    .where("startsAt", ">=", start)
    .where("startsAt", "<", end)
    .orderBy("startsAt")
    .get();

  const appointments: DayAppointment[] = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        startsAt: data.startsAt?.toDate?.()?.toISOString?.() ?? "",
        status: String(data.status ?? ""),
        total: Number(data.total ?? 0),
        balance: Number(data.balance ?? 0),
        clientId: String(data.clientId ?? ""),
        clientName: String(data.clientName ?? ""),
        clientPhoto: (data.clientPhoto as string | null) ?? null,
        staffId: String(data.staffId ?? ""),
        staffName: String(data.staffName ?? ""),
        staffPhoto: (data.staffPhoto as string | null) ?? null,
        serviceNames: Array.isArray(data.items) ? data.items.map((item: { name?: string }) => item.name ?? "").join(", ") : "",
      };
    })
    .filter((a) => ACTIVE_STATUSES.has(a.status));

  const facturado = appointments.reduce((sum, a) => sum + a.total, 0);
  const porCobrar = appointments.reduce((sum, a) => sum + a.balance, 0);

  return {
    dateISO,
    appointments,
    turnos: appointments.length,
    facturado,
    cobrado: facturado - porCobrar,
    porCobrar,
  };
}

/**
 * Mismo criterio que `getDaySummary` (estados activos, facturado/cobrado/
 * por cobrar) pero para un rango arbitrario -- pensado para semana/mes de
 * la home. Pasale `{ start, end }` ya armado con `weekRange`/`monthRange`
 * de `lib/dates.ts`, nunca fechas sueltas. No devuelve el array de turnos
 * (en un mes serían cientos): si otra pantalla necesita el detalle turno
 * por turno de un rango largo, que haga su propia query, esto es solo
 * para los 2-3 números de un KPI.
 */
export async function getRangeSummary(tenantId: string, range: { start: Date; end: Date }): Promise<RangeSummary> {
  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const snapshot = await tenantRef
    .collection("appointments")
    .where("startsAt", ">=", range.start)
    .where("startsAt", "<", range.end)
    .select("status", "total", "balance")
    .get();

  let turnos = 0;
  let facturado = 0;
  let porCobrar = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!ACTIVE_STATUSES.has(String(data.status ?? ""))) continue;
    turnos += 1;
    facturado += Number(data.total ?? 0);
    porCobrar += Number(data.balance ?? 0);
  }

  return { turnos, facturado, cobrado: facturado - porCobrar, porCobrar };
}
