import "server-only";
import { cache } from "react";
import { firebaseAdmin } from "./admin";
import { dayRange } from "@/lib/dates";
import {
  POR_COBRAR_STATUSES,
  isRefundDue,
  normalizePayment,
  summarizeAppointments,
  summarizePayments,
  toPaymentSummary,
  type NormalizedPayment,
  type PaymentBreakdown,
  type PaymentSummary,
} from "./stats-model";

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
  /** Definición única de "Cobrado" (ver stats-model.ts): bruto de pagos aprobados por `paidAt`. */
  cobrado: number;
  /** Definición única de "Por cobrar" (ver stats-model.ts). */
  porCobrar: number;
  /** Señas de turnos cancelados que hay que devolver (no suman en `cobrado`). */
  aDevolver: number;
};

export type RangeSummary = {
  turnos: number;
  facturado: number;
  cobrado: number;
  porCobrar: number;
  aDevolver: number;
};

export type { PaymentBreakdown, PaymentSummary } from "./stats-model";

// `cache` = una sola lectura por request aunque la home pida el mismo rango
// por dos caminos (getRangeSummary + getPaymentSummary). La clave tiene que
// ser primitiva: dos `Date` iguales son objetos distintos para `cache`.
const fetchPayments = cache(async (tenantId: string, startMs: number, endMs: number): Promise<NormalizedPayment[]> => {
  const snapshot = await firebaseAdmin().db.collectionGroup("payments")
    .where("tenantId", "==", tenantId)
    .where("paidAt", ">=", new Date(startMs))
    .where("paidAt", "<", new Date(endMs))
    .get();
  return snapshot.docs
    .map((doc) => normalizePayment(doc.id, doc.data()))
    .filter((payment): payment is NormalizedPayment => payment !== null);
});

/** Pagos aprobados con `paidAt` en [start, end). El array es compartido dentro del request: no lo mutes. */
export async function getPayments(tenantId: string, range: { start: Date; end: Date }): Promise<NormalizedPayment[]> {
  return fetchPayments(tenantId, range.start.getTime(), range.end.getTime());
}

/**
 * Turnos con plata "a devolver" (ver `isRefundDue`). Query de igualdad sobre
 * un solo campo (índice automático, sin índice compuesto) y solo los campos
 * necesarios: son pocos turnos y se comparte en todo el request.
 */
export const getRefundDueAppointmentIds = cache(async (tenantId: string): Promise<ReadonlySet<string>> => {
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("appointments")
    .where("depositDisposition", "==", "refund_required")
    .select("status", "depositDisposition", "depositRefunded")
    .get();
  return new Set(snapshot.docs.filter((doc) => isRefundDue(doc.data())).map((doc) => doc.id));
});

export async function getPaymentBreakdown(tenantId: string, range: { start: Date; end: Date }): Promise<PaymentBreakdown> {
  const [payments, refundDueIds] = await Promise.all([getPayments(tenantId, range), getRefundDueAppointmentIds(tenantId)]);
  return summarizePayments(payments, refundDueIds);
}

export async function getPaymentSummary(tenantId: string, range: { start: Date; end: Date }): Promise<PaymentSummary> {
  return toPaymentSummary(await getPaymentBreakdown(tenantId, range));
}

const DAY_FIELDS = [
  "startsAt", "status", "total", "balance", "clientId", "clientName", "clientPhoto",
  "staffId", "staffName", "staffPhoto", "items",
] as const;

/**
 * Turnos firmes (confirmed/completed) de un día + los totales con las
 * definiciones únicas de stats-model.ts: facturado = suma de `total`,
 * por cobrar = `porCobrarOf`, cobrado = bruto de pagos aprobados del día.
 * Única fuente de verdad para que Home, Caja y Reportes no muestren
 * números distintos para "lo mismo".
 */
export async function getDaySummary(tenantId: string, dateISO: string, timezone: string): Promise<DaySummary> {
  const range = dayRange(dateISO, timezone);
  const { db } = firebaseAdmin();
  const [snapshot, payments] = await Promise.all([
    db.collection("tenants").doc(tenantId)
      .collection("appointments")
      .where("startsAt", ">=", range.start)
      .where("startsAt", "<", range.end)
      .orderBy("startsAt")
      .select(...DAY_FIELDS)
      .get(),
    getPaymentBreakdown(tenantId, range),
  ]);

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
    .filter((a) => POR_COBRAR_STATUSES.has(a.status));

  const totals = summarizeAppointments(appointments);
  return {
    dateISO,
    appointments,
    turnos: totals.turnos,
    facturado: totals.facturado,
    cobrado: payments.gross,
    porCobrar: totals.porCobrar,
    aDevolver: payments.refundDue.gross,
  };
}

/**
 * Mismas definiciones que `getDaySummary` pero para un rango arbitrario --
 * pensado para semana/mes de la home. Pasale `{ start, end }` ya armado con
 * `weekRange`/`monthRange` de `lib/dates.ts`, nunca fechas sueltas. No
 * devuelve el array de turnos (en un mes serían cientos): es solo para los
 * 2-3 números de un KPI. `cobrado` sale de los pagos (por `paidAt`), no de
 * `total - balance`: así coincide con Caja y Reportes.
 */
export async function getRangeSummary(tenantId: string, range: { start: Date; end: Date }): Promise<RangeSummary> {
  const { db } = firebaseAdmin();
  const [snapshot, payments] = await Promise.all([
    db.collection("tenants").doc(tenantId)
      .collection("appointments")
      .where("startsAt", ">=", range.start)
      .where("startsAt", "<", range.end)
      .select("status", "total", "balance")
      .get(),
    getPaymentBreakdown(tenantId, range),
  ]);
  const totals = summarizeAppointments(snapshot.docs.map((doc) => doc.data()));
  return { ...totals, cobrado: payments.gross, aDevolver: payments.refundDue.gross };
}
