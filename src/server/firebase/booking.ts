import "server-only";
import { FieldValue, Timestamp, type Firestore, type Transaction } from "firebase-admin/firestore";
import { intersectRanges, subtractRanges, type TimeRange } from "@/domain/availability";
import { firebaseAdmin } from "./admin";
import { dayBoundsUTC, instantToMinutes, minutesToInstant, timeToMinutes } from "@/server/availability";
import { minutesOfDayInTz, toDateISOInTz, weekdayOf } from "@/lib/dates";
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

  // instantToMinutes() siempre devuelve 0-1439 (es el minuto-del-día de un
  // INSTANTE puntual) -- los Math.max(0,...)/Math.min(24*60,...) que había
  // antes acá eran no-ops, nunca recortaban nada. El bug real: un bloqueo
  // que cruza medianoche (p. ej. lunes 15:00 a miércoles 10:00) arma, para
  // un día completamente adentro del bloqueo (el martes), start=900 (15:00
  // del lunes) y end=600 (10:00 del miércoles) -- un rango INVERTIDO
  // (start > end). subtractRanges (domain/availability/ranges.ts) no
  // detecta esa inversión como "todo el día bloqueado": la resta a la
  // mitad deja casi todo el día libre. Por eso había que comparar el
  // inicio/fin real del bloqueo contra los límites del DÍA evaluado
  // (startDate/endDate, ya calculados arriba con dayBoundsUTC -- los
  // mismos límites que da dayRange() de src/lib/dates.ts): si el bloqueo
  // ya corría antes de que empezara el día, el día entero arranca
  // bloqueado (start=0); si sigue después de que termina, termina
  // bloqueado (end=24*60).
  const blocked: TimeRange[] = blocksSnapshot.docs
    .map((doc) => doc.data())
    .filter((block) => (!block.staffId || block.staffId === params.staffId) && block.startsAt.toDate() < endDate)
    .map((block) => {
      const blockStart: Date = block.startsAt.toDate();
      const blockEnd: Date = block.endsAt.toDate();
      return {
        start: blockStart < startDate ? 0 : instantToMinutes(blockStart.toISOString(), params.timezone),
        end: blockEnd > endDate ? 24 * 60 : instantToMinutes(blockEnd.toISOString(), params.timezone),
      };
    });

  return subtractRanges(window, blocked);
}

/**
 * ¿Está libre el rango [startsAt, startsAt+durationMin) para `staffId`?
 *
 * Si se llama con `transaction`, las lecturas de los documentos de
 * ocupación se hacen con `transaction.getAll(...)` -- la única forma de
 * que una lectura adentro de una transacción de Firestore tenga garantías
 * reales. Antes esta función hacía `Promise.all(refs.map(r => r.get()))`
 * SIEMPRE, aunque se llamara desde dentro de `db.runTransaction(...)` en
 * `createInternalAppointment`: esas lecturas directas no quedan
 * registradas en la transacción, así que Firestore no detecta el
 * conflicto si otra reserva escribe el mismo slot en el medio -- dos
 * reservas simultáneas podían leer "libre" las dos y confirmar las dos
 * (condición de carrera real, no teórica). `listAvailableStarts` solo
 * lista horarios para MOSTRAR (no reserva nada), así que ahí se sigue
 * llamando sin `transaction` -- la consistencia fuerte importa en el
 * momento de confirmar, no en el de listar.
 */
async function isRangeFreeOfOccupancy(
  db: Firestore,
  tenantId: string,
  staffId: string,
  startsAt: Date,
  durationMin: number,
  options: { excludeAppointmentId?: string; transaction?: Transaction } = {},
): Promise<boolean> {
  const slots = occupancySlotInstants(startsAt, durationMin).map((instant) =>
    db.collection("tenants").doc(tenantId).collection("occupancy").doc(occupancyDocId(staffId, instant)),
  );
  const snapshots = options.transaction
    ? await options.transaction.getAll(...slots)
    : await Promise.all(slots.map((ref) => ref.get()));
  const now = new Date();
  return snapshots.every((snapshot) => {
    if (!snapshot.exists) return true;
    const data = snapshot.data()!;
    if (options.excludeAppointmentId && data.appointmentId === options.excludeAppointmentId) return true;
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

  const weekday = weekdayOf(params.dateISO);
  const businessHours: TimeRange[] = (params.tenant.businessHours ?? [])
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: timeToMinutes(h.opensAt), end: timeToMinutes(h.closesAt) }));
  if (businessHours.length === 0) return [];

  const slotIntervalMin = params.tenant.settings?.slotIntervalMin ?? 15;
  const minNoticeMin = params.tenant.settings?.minNoticeMin ?? 60;
  const now = params.now ?? new Date();
  const todayISO = toDateISOInTz(now, params.timezone);
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

  // Para el bug #3 (ver abajo) hace falta saber qué día/horario calendario
  // es `startsAt` en la zona del tenant -- se deriva una sola vez acá,
  // fuera de la transacción (no depende de datos que puedan cambiar en el
  // medio, son puras funciones de fecha).
  const dateISO = toDateISOInTz(startsAt, input.tenant.timezone);
  const weekday = weekdayOf(dateISO);
  const businessHours: TimeRange[] = (input.tenant.businessHours ?? [])
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ start: timeToMinutes(h.opensAt), end: timeToMinutes(h.closesAt) }));
  const requestedStartMinutes = minutesOfDayInTz(startsAt, input.tenant.timezone);

  const deposit = Math.max(0, input.depositAmount ?? 0);
  const appointmentRef = tenantRef.collection("appointments").doc();

  const staffId = await db.runTransaction(async (transaction) => {
    let oldAppointment: FirebaseFirestore.DocumentSnapshot | null = null;
    let oldAppointmentRef: FirebaseFirestore.DocumentReference | null = null;
    if (input.rescheduledFromId) {
      oldAppointmentRef = tenantRef.collection("appointments").doc(input.rescheduledFromId);
      oldAppointment = await transaction.get(oldAppointmentRef);
    }

    const clientSnapshot = await transaction.get(tenantRef.collection("clients").doc(input.clientId));
    const clientPhoto = (clientSnapshot.data()?.photoUrl as string | null | undefined) ?? null;

    let selected: string | null = null;
    for (const candidate of candidateIds) {
      // Bug #3: antes, cuando staffId === "any", este loop solo chequeaba
      // OCUPACIÓN (turnos ya agendados) -- nunca repetía el chequeo de
      // horario propio/bloqueos que `listAvailableStarts` sí hace vía
      // `freeWindowsForStaffDay` para decidir qué mostrar. Resultado: un
      // slot que se ve "disponible" porque ALGÚN profesional lo tenía
      // libre podía terminar asignado, al confirmar, a un profesional que
      // en realidad no trabaja ese horario (o tiene un bloqueo encima).
      // Se repite el mismo chequeo de ventana real acá, para cada
      // candidato, antes de aceptarlo -- así "Cualquiera" nunca asigna a
      // alguien fuera de su propio horario. Se aplica también cuando el
      // panel ya manda un profesional puntual (no solo "any"): si llegó
      // un startsAt desalineado con su horario (p. ej. un slot viejo en
      // caché), queda igual de protegido.
      if (businessHours.length === 0) continue;
      const freeWindows = await freeWindowsForStaffDay({
        tenantId: input.tenantId,
        tenant: input.tenant,
        staffId: candidate,
        dateISO,
        timezone: input.tenant.timezone,
        weekday,
        businessHours,
      });
      const fitsSchedule = freeWindows.some(
        (w) => requestedStartMinutes >= w.start && requestedStartMinutes + service.durationMin <= w.end,
      );
      if (!fitsSchedule) continue;

      // Bug #1: hay que excluir el turno que se está reprogramando de su
      // propia ocupación vieja -- si no, mover un turno 15-30min (mismo
      // profesional, rango que se solapa con el de antes) siempre falla
      // con "Ese horario ya no está disponible" porque choca contra SU
      // PROPIA ocupación, que todavía no se borró (se borra más abajo,
      // después de confirmar el turno nuevo). Bug #2: se pasa `transaction`
      // para que la lectura de los documentos de ocupación cuente como
      // lectura transaccional de verdad (`transaction.getAll`) y no una
      // lectura directa sin ninguna garantía -- sin esto, dos reservas
      // simultáneas para el mismo instante podían leer "libre" las dos y
      // confirmar las dos (condición de carrera real).
      const free = await isRangeFreeOfOccupancy(db, input.tenantId, candidate, startsAt, service.durationMin, {
        excludeAppointmentId: input.rescheduledFromId,
        transaction,
      });
      if (free) {
        selected = candidate;
        break;
      }
    }
    if (!selected) throw new Error("Ese horario ya no está disponible");

    // El home ("Hoy en...") y Caja leen staffName/staffPhoto del propio
    // turno (no hacen join en vivo con staff), así que hay que
    // denormalizarlos acá -- si no, se ven turnos sin nombre ni foto del
    // profesional ahí (la vista /agenda sí hace join, por eso ahí se ve bien).
    const staffSnapshot = await transaction.get(tenantRef.collection("staff").doc(selected));
    const staffData = staffSnapshot.data();

    const newOccupancyInstants = occupancySlotInstants(startsAt, service.durationMin);
    // Bug #1 (parte 2): el set de IDs de los slots que este turno NUEVO va
    // a ocupar -- hace falta más abajo para no borrar, al liberar el
    // turno VIEJO reprogramado, un slot que el turno nuevo acaba de
    // escribir en esta misma transacción (pasa cuando el rango nuevo y el
    // viejo se solapan, mismo profesional).
    const newOccupancyIds = new Set(newOccupancyInstants.map((instant) => occupancyDocId(selected, instant)));

    for (const instant of newOccupancyInstants) {
      transaction.set(tenantRef.collection("occupancy").doc(occupancyDocId(selected, instant)), {
        appointmentId: appointmentRef.id,
        tenantId: input.tenantId,
      });
    }

    transaction.create(appointmentRef, {
      id: appointmentRef.id,
      tenantId: input.tenantId,
      staffId: selected,
      staffName: staffData?.displayName ?? "",
      staffPhoto: staffData?.photoUrl ?? null,
      clientId: input.clientId,
      clientName: input.clientName,
      clientPhoto,
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
      const oldDurationMin = Math.round((oldData.endsAt.toDate().getTime() - oldData.startsAt.toDate().getTime()) / 60_000);
      for (const instant of occupancySlotInstants(oldData.startsAt.toDate(), oldDurationMin)) {
        const oldSlotId = occupancyDocId(oldData.staffId, instant);
        // Bug #1 (parte 2): si el turno nuevo y el viejo se solapan en
        // algún slot de 15min (mismo profesional, reprogramación a un
        // horario cercano), ese slot ya quedó reescrito más arriba con el
        // appointmentId del turno NUEVO -- borrarlo acá lo liberaría por
        // error, dejando ese instante "disponible" mientras el turno
        // nuevo sigue ocupándolo en teoría.
        if (newOccupancyIds.has(oldSlotId)) continue;
        transaction.delete(tenantRef.collection("occupancy").doc(oldSlotId));
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
