import "server-only";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { intersectRanges, subtractRanges, type TimeRange } from "@/domain/availability";
import { firebaseAdmin } from "./admin";
import { dayBoundsUTC, instantToMinutes, minutesToInstant, timeToMinutes } from "@/server/availability";
import type { TenantRecord } from "./tenants";

/**
 * Motor de disponibilidad y reserva compartido por el turnero público y la
 * agenda interna (mismo modelo Firestore para los dos). Grilla de 15
 * minutos: cada turno ocupa un documento de ocupación por cada intervalo
 * de 15 minutos que dura, tanto para holds temporales (10 min, turnero
 * público) como para turnos confirmados (permanentes, sin expiresAt).
 */
export const SLOT_MINUTES = 15;

function occupancySlotSuffix(instant: Date) {
  return instant.toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

export function occupancyDocId(staffId: string, instant: Date) {
  return `${staffId}_${occupancySlotSuffix(instant)}`;
}

export function occupancySlotInstants(startsAt: Date, durationMin: number): Date[] {
  const count = Math.max(1, Math.ceil(durationMin / SLOT_MINUTES));
  return Array.from({ length: count }, (_, i) => new Date(startsAt.getTime() + i * SLOT_MINUTES * 60_000));
}

export function serviceDurationMinutes(data: { phases?: { minutes?: number }[]; bufferAfterMin?: number }): number {
  return (data.phases ?? []).reduce((sum, phase) => sum + Number(phase.minutes ?? 0), 0) + Number(data.bufferAfterMin ?? 0);
}

export async function getServiceRecord(tenantId: string, serviceId: string) {
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("services").doc(serviceId).get();
  if (!doc.exists) throw new Error(`Servicio ${serviceId} no encontrado`);
  const data = doc.data()!;
  return { id: doc.id, name: String(data.name), price: Number(data.price), durationMin: serviceDurationMinutes(data) };
}

/** Profesionales activos que dictan este servicio (staff.serviceIds). */
export async function getEligibleStaffIds(tenantId: string, serviceId: string): Promise<string[]> {
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return snapshot.docs.filter((doc) => (doc.data().serviceIds ?? []).includes(serviceId)).map((doc) => doc.id);
}

/**
 * Ventana libre del profesional para el día: horario del local ∩ horario
 * propio del profesional (si tiene uno configurado para ese día; si no
 * configuró nada todavía, no se restringe -- así un tenant recién creado
 * ya puede recibir turnos sin que el owner tenga que llenar el horario de
 * cada profesional primero) − bloqueos de horario (del local o suyos).
 */
async function freeWindowsForStaffDay(params: {
  tenantId: string;
  tenant: TenantRecord;
  staffId: string;
  dateISO: string;
  timezone: string;
  weekday: number;
  businessHours: TimeRange[];
}): Promise<TimeRange[]> {
  if (params.businessHours.length === 0) return [];
  const db = firebaseAdmin().db;

  const staffDoc = await db.collection("tenants").doc(params.tenantId).collection("staff").doc(params.staffId).get();
  const schedules = (staffDoc.data()?.schedules ?? []) as { weekday: number; starts_at: string; ends_at: string }[];
  const ownSchedule = schedules
    .filter((s) => s.weekday === params.weekday)
    .map((s) => ({ start: timeToMinutes(s.starts_at), end: timeToMinutes(s.ends_at) }));
  const window = ownSchedule.length > 0 ? intersectRanges(params.businessHours, ownSchedule) : params.businessHours;
  if (window.length === 0) return [];

  const { startUTC, endUTC } = dayBoundsUTC(params.dateISO, params.timezone);
  const startDate = new Date(startUTC);
  const endDate = new Date(endUTC);

  // Un solo filtro de rango (endsAt) evita depender de un índice compuesto
  // que todavía no existe en el proyecto Firestore.
  const blocksSnapshot = await db
    .collection("tenants")
    .doc(params.tenantId)
    .collection("timeBlocks")
    .where("endsAt", ">", startDate)
    .get();

  const blocked: TimeRange[] = blocksSnapshot.docs
    .map((doc) => doc.data())
    .filter((block) => (!block.staffId || block.staffId === params.staffId) && block.startsAt.toDate() < endDate)
    .map((block) => ({
      start: Math.max(0, instantToMinutes(block.startsAt.toDate().toISOString(), params.timezone)),
      end: Math.min(24 * 60, instantToMinutes(block.endsAt.toDate().toISOString(), params.timezone)),
    }));

  return subtractRanges(window, blocked);
}

async function isRangeFreeOfOccupancy(
  db: Firestore,
  tenantId: string,
  staffId: string,
  startsAt: Date,
  durationMin: number,
  excludeAppointmentId?: string,
): Promise<boolean> {
  const slots = occupancySlotInstants(startsAt, durationMin).map((instant) =>
    db.collection("tenants").doc(tenantId).collection("occupancy").doc(occupancyDocId(staffId, instant)),
  );
  const snapshots = await Promise.all(slots.map((ref) => ref.get()));
  const now = new Date();
  return snapshots.every((snapshot) => {
    if (!snapshot.exists) return true;
    const data = snapshot.data()!;
    if (excludeAppointmentId && data.appointmentId === excludeAppointmentId) return true;
    const expiresAt = data.expiresAt?.toDate?.();
    return expiresAt ? expiresAt < now : false;
  });
}

/** Todos los inicios posibles (alineados a slotIntervalMin) para un día, para un profesional puntual o "cualquiera". */
export async function listAvailableStarts(params: {
  tenantId: string;
  tenant: TenantRecord;
  serviceId: string;
  staffId: string | "any";
  dateISO: string;
  timezone: string;
  now?: Date;
}): Promise<Date[]> {
  const db = firebaseAdmin().db;
  const service = await getServiceRecord(params.tenantId, params.serviceId);
  const eligibleIds = params.staffId === "any" ? await getEligibleStaffIds(params.tenantId, params.serviceId) : [params.staffId];
  if (eligibleIds.length === 0) return [];

  const weekday = new TZDate(`${params.dateISO}T12:00:00`, params.timezone).getDay();
  const businessHours: TimeRange[] = (params.tenant.businessHours ?? [])
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: timeToMinutes(h.opensAt), end: timeToMinutes(h.closesAt) }));
  if (businessHours.length === 0) return [];

  const slotIntervalMin = params.tenant.settings?.slotIntervalMin ?? 15;
  const minNoticeMin = params.tenant.settings?.minNoticeMin ?? 60;
  const now = params.now ?? new Date();
  const todayISO = format(new TZDate(now, params.timezone), "yyyy-MM-dd");
  const earliestStart =
    params.dateISO === todayISO ? instantToMinutes(now.toISOString(), params.timezone) + minNoticeMin : -Infinity;

  const dayStart = Math.min(...businessHours.map((h) => h.start));
  const dayEnd = Math.max(...businessHours.map((h) => h.end));
  const alignedStart = Math.ceil(dayStart / slotIntervalMin) * slotIntervalMin;

  const found = new Set<number>();
  for (const staffId of eligibleIds) {
    const freeWindows = await freeWindowsForStaffDay({
      tenantId: params.tenantId,
      tenant: params.tenant,
      staffId,
      dateISO: params.dateISO,
      timezone: params.timezone,
      weekday,
      businessHours,
    });
    if (freeWindows.length === 0) continue;

    for (let start = alignedStart; start + service.durationMin <= dayEnd; start += slotIntervalMin) {
      if (start < earliestStart || found.has(start)) continue;
      const fitsSchedule = freeWindows.some((w) => start >= w.start && start + service.durationMin <= w.end);
      if (!fitsSchedule) continue;

      const startsAt = minutesToInstant(params.dateISO, start, params.timezone);
      const free = await isRangeFreeOfOccupancy(db, params.tenantId, staffId, startsAt, service.durationMin);
      if (free) found.add(start);
    }
  }

  return Array.from(found)
    .sort((a, b) => a - b)
    .map((minute) => minutesToInstant(params.dateISO, minute, params.timezone));
}

export type CreateAppointmentInput = {
  tenantId: string;
  tenant: TenantRecord;
  serviceId: string;
  staffId: string | "any";
  startsAtISO: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  depositAmount?: number;
  depositMethod?: "cash" | "mercadopago";
  /** Si viene de reprogramar otro turno: se cancela y libera el original en la misma transacción. */
  rescheduledFromId?: string;
};

/**
 * Reserva directa desde la agenda interna (sin hold de 10 minutos: quien
 * reserva ya está autenticado en el panel). Si `staffId` es "any", resuelve
 * al primer profesional elegible con el rango libre -- mismo criterio que
 * usa el turnero público al confirmar un hold.
 */
export async function createInternalAppointment(input: CreateAppointmentInput) {
  const db = firebaseAdmin().db;
  const service = await getServiceRecord(input.tenantId, input.serviceId);
  const startsAt = new Date(input.startsAtISO);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const tenantRef = db.collection("tenants").doc(input.tenantId);

  const candidateIds = input.staffId === "any" ? await getEligibleStaffIds(input.tenantId, input.serviceId) : [input.staffId];
  if (candidateIds.length === 0) throw new Error("No hay profesionales disponibles para este servicio");

  const deposit = Math.max(0, input.depositAmount ?? 0);
  const appointmentRef = tenantRef.collection("appointments").doc();

  const staffId = await db.runTransaction(async (transaction) => {
    let oldAppointment: FirebaseFirestore.DocumentSnapshot | null = null;
    let oldAppointmentRef: FirebaseFirestore.DocumentReference | null = null;
    if (input.rescheduledFromId) {
      oldAppointmentRef = tenantRef.collection("appointments").doc(input.rescheduledFromId);
      oldAppointment = await transaction.get(oldAppointmentRef);
    }

    let selected: string | null = null;
    for (const candidate of candidateIds) {
      const free = await isRangeFreeOfOccupancy(db, input.tenantId, candidate, startsAt, service.durationMin);
      if (free) {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error("Ese horario ya no está disponible");

    for (const instant of occupancySlotInstants(startsAt, service.durationMin)) {
      transaction.set(tenantRef.collection("occupancy").doc(occupancyDocId(selected, instant)), {
        appointmentId: appointmentRef.id,
        tenantId: input.tenantId,
      });
    }

    transaction.create(appointmentRef, {
      id: appointmentRef.id,
      tenantId: input.tenantId,
      staffId: selected,
      clientId: input.clientId,
      clientName: input.clientName,
      clientPhone: input.clientPhone,
      clientEmail: input.clientEmail || null,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      status: "confirmed",
      total: service.price,
      balance: Math.max(0, service.price - deposit),
      depositPaid: deposit,
      items: [{ serviceId: service.id, name: service.name, price: service.price }],
      rescheduledFromId: input.rescheduledFromId ?? null,
      cancelReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (deposit > 0 && input.depositMethod) {
      transaction.create(appointmentRef.collection("payments").doc(), {
        amount: deposit,
        method: input.depositMethod,
        status: "approved",
        createdAt: Timestamp.now(),
      });
    }

    if (oldAppointmentRef && oldAppointment?.exists) {
      const oldData = oldAppointment.data()!;
      for (const instant of occupancySlotInstants(oldData.startsAt.toDate(), Math.round((oldData.endsAt.toDate().getTime() - oldData.startsAt.toDate().getTime()) / 60_000))) {
        transaction.delete(tenantRef.collection("occupancy").doc(occupancyDocId(oldData.staffId, instant)));
      }
      transaction.update(oldAppointmentRef, {
        status: "cancelled",
        cancelReason: "Reprogramado",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return selected;
  });

  return { id: appointmentRef.id, staffId, total: service.price, balance: Math.max(0, service.price - deposit) };
}

/** Libera los documentos de ocupación de un turno (cancelación o "no vino"). */
export async function releaseAppointmentOccupancy(tenantId: string, appointmentId: string) {
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(appointmentId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists) return;
    const data = snapshot.data()!;
    const startsAt: Date = data.startsAt.toDate();
    const endsAt: Date = data.endsAt.toDate();
    const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
    for (const instant of occupancySlotInstants(startsAt, durationMin)) {
      transaction.delete(tenantRef.collection("occupancy").doc(occupancyDocId(data.staffId, instant)));
    }
  });
}
