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
