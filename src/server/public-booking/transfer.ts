import "server-only";
import crypto from "node:crypto";
import { FieldValue, Timestamp, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { calculateDeposit } from "@/domain/money/deposit";
import { paymentDocument, roundMoney } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase, type TenantRecord, type TransferSettings } from "@/server/firebase/tenants";
import { recordTrustedAnalyticsEvent } from "@/server/analytics";
import { cleanPublicClient, tenantPhoneKey, type PublicClientInput } from "./client";
import {
  activePendingIds,
  isTransferReady,
  MAX_PENDING_TRANSFERS_PER_PHONE,
  MAX_PENDING_TRANSFERS_PER_TENANT,
  TRANSFER_MIN_LEAD_HOURS,
  transferDeadline,
} from "./payment-methods";

/**
 * Seña por transferencia bancaria. El turno se crea como `pending_payment`
 * (el mismo estado "pendiente" que ya entienden agenda, caja y stats) con
 * `awaitingTransfer: true`: ocupa el horario igual que uno confirmado, no
 * suma plata ni cuenta como visita, y queda así hasta que la dueña confirma
 * el comprobante (o lo rechaza, o vence). Cada turno pendiente tiene además:
 * - un documento en `pendingTransfers` (colección raíz, filtros de un solo
 *   campo: tenantId / expiresAt) para que el cron, la lista de la dueña y el
 *   tope por local no dependan de índices compuestos ni de collection group;
 * - una entrada en `pendingTransferPhones/{tenantId}_{teléfono}` (mapa
 *   appointmentId -> vencimiento) que hace el tope por WhatsApp a prueba de
 *   carreras: dos reservas simultáneas leen y escriben el MISMO documento
 *   dentro de la transacción, así que una de las dos se reintenta y ve a la otra.
 * Todo camino que termina la espera (confirmar, rechazar, vencer, cancelar
 * desde el panel o desde Mi turno) borra ambas cosas con `endTransferWait`
 * DENTRO de su transacción.
 *
 * Ficha de la clienta: una reserva anónima NO se vincula a ninguna ficha
 * existente por teléfono (cualquiera puede escribir el WhatsApp de otra
 * persona). Los datos que cargó quedan en el turno (`pendingClient`, más
 * clientName/clientPhone para que agenda y listas lo muestren) y la ficha se
 * busca o se crea recién cuando la dueña confirma el comprobante. Ahí también
 * se suman los contadores (appointmentsCount, totalSpent): cancelar o vencer
 * no tiene nada que revertir.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** Intentos fallidos del cron sobre un mismo pendiente antes de sacarlo de la cola. */
const MAX_EXPIRE_ATTEMPTS = 3;

function pendingTransferRef(tenantId: string, appointmentId: string) {
  return firebaseAdmin().db.collection("pendingTransfers").doc(`${tenantId}_${appointmentId}`);
}

function pendingPhoneRef(phoneKey: string) {
  return firebaseAdmin().db.collection("pendingTransferPhones").doc(phoneKey);
}

/** Clave del contador por teléfono de un turno: la guardada al reservar o, en turnos viejos, la derivada del teléfono. */
function transferPhoneKeyOf(tenantId: string, data: DocumentData): string | null {
  if (typeof data.transferPhoneKey === "string" && data.transferPhoneKey) return data.transferPhoneKey;
  const phone = typeof data.clientPhone === "string" ? data.clientPhone : "";
  return phone.replace(/\D/g, "") ? tenantPhoneKey(tenantId, phone) : null;
}

/**
 * Termina la espera de una transferencia DENTRO de la transacción que cambia
 * el turno: borra el pendiente y saca el turno del contador por teléfono.
 * Solo escribe (no lee), así que se puede llamar después de las lecturas de
 * cualquier transacción. Idempotente. `data` = el turno ANTES del cambio.
 */
export function endTransferWait(transaction: Transaction, tenantId: string, appointmentId: string, data: DocumentData | undefined) {
  transaction.delete(pendingTransferRef(tenantId, appointmentId));
  if (!data || data.awaitingTransfer !== true) return;
  const phoneKey = transferPhoneKeyOf(tenantId, data);
  if (!phoneKey) return;
  transaction.set(pendingPhoneRef(phoneKey), {
    active: { [appointmentId]: FieldValue.delete() },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

function depositFor(tenant: TenantRecord, price: number) {
  const settings = tenant.settings;
  return roundMoney(calculateDeposit(price, settings.depositType === "none"
    ? { type: "none" }
    : { type: settings.depositType, value: settings.depositValue, min: settings.depositMin }));
}

export async function createTransferAppointment(input: { slug: string; holdId: string; client: PublicClientInput }) {
  if (typeof input.holdId !== "string" || !ID_PATTERN.test(input.holdId)) throw new Error("La reserva venció. Elegí el horario de nuevo.");
  const client = cleanPublicClient(input.client);
  const tenant = await getTenantBySlugFromFirebase(input.slug);
  if (!tenant || tenant.status === "suspended") throw new Error("Este turnero no está disponible");
  if (tenant.settings.publicBookingEnabled === false) throw new Error("Las reservas online están pausadas");
  if (tenant.settings.depositType === "none") throw new Error("La reserva online requiere una seña configurada");
  if (!isTransferReady(tenant.settings.payments?.transfer)) throw new Error("Este local no recibe señas por transferencia");

  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(tenant.id);
  const holdRef = tenantRef.collection("holds").doc(input.holdId);
  const appointmentRef = tenantRef.collection("appointments").doc();
  const token = crypto.randomUUID().replace(/-/g, "");
  const phoneKey = tenantPhoneKey(tenant.id, client.phone);
  const phoneCounterRef = pendingPhoneRef(phoneKey);
  let expiresAtISO = "";

  await db.runTransaction(async (transaction) => {
    // Firestore exige todas las lecturas antes de la primera escritura.
    const hold = await transaction.get(holdRef);
    const now = Date.now();
    if (!hold.exists || hold.data()!.expiresAt.toMillis() <= now) throw new Error("La reserva venció. Elegí el horario de nuevo.");
    const holdData = hold.data()!;
    const [service, staff] = await Promise.all([
      transaction.get(tenantRef.collection("services").doc(String(holdData.serviceId))),
      transaction.get(tenantRef.collection("staff").doc(String(holdData.staffId))),
    ]);
    if (
      !service.exists ||
      service.data()?.active === false ||
      service.data()?.public === false ||
      service.data()?.archivedAt
    ) {
      throw new Error("El servicio ya no está disponible");
    }
    if (!staff.exists || staff.data()?.active === false) throw new Error("Ese horario ya no está disponible");

    const startsAt: Date = holdData.startsAt.toDate();
    const endsAt: Date = holdData.endsAt.toDate();
    const deadline = transferDeadline(startsAt, new Date(now));
    if (!deadline) {
      throw new Error(`Para turnos con menos de ${TRANSFER_MIN_LEAD_HOURS} h de anticipación la seña no se puede pagar por transferencia. Elegí otro horario.`);
    }
    const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
    const occupancyRefs = occupancySlotInstants(startsAt, durationMin).map((instant) =>
      tenantRef.collection("occupancy").doc(occupancyDocId(String(holdData.staffId), instant)),
    );
    const occupancy = await transaction.getAll(...occupancyRefs);
    const free = occupancy.every((slot) => {
      if (!slot.exists) return true;
      const data = slot.data()!;
      if (data.holdId === holdRef.id) return true;
      const expiresAt = data.expiresAt?.toMillis?.();
      return typeof expiresAt === "number" && expiresAt < now;
    });
    if (!free) throw new Error("Ese horario ya no está disponible");

    // Tope por local (filtro de un solo campo; los vencidos que el cron
    // todavía no procesó no cuentan).
    const openForTenant = await transaction.get(db.collection("pendingTransfers").where("tenantId", "==", tenant.id).limit(100));
    const activeForTenant = openForTenant.docs.filter((doc) => (doc.data().expiresAt?.toMillis?.() ?? 0) > now);
    if (activeForTenant.length >= MAX_PENDING_TRANSFERS_PER_TENANT) {
      throw new Error("El local tiene muchas reservas esperando confirmación. Probá pagar la seña con Mercado Pago o intentá más tarde.");
    }

    // Tope por WhatsApp: sin esto, alguien podría bloquear media agenda
    // reservando "por transferencia" sin pagar nunca. El contador es el que
    // lo hace a prueba de carreras; los pendientes de antes del contador se
    // suman desde la consulta del local que ya se hizo arriba.
    const phoneCounter = await transaction.get(phoneCounterRef);
    const counterEntries = (phoneCounter.data()?.active ?? null) as Record<string, unknown> | null;
    const activeForPhone = new Set(activePendingIds(counterEntries, now));
    activeForTenant
      .filter((doc) => doc.data().phoneKey === phoneKey)
      .forEach((doc) => activeForPhone.add(String(doc.data().appointmentId ?? doc.id)));
    if (activeForPhone.size >= MAX_PENDING_TRANSFERS_PER_PHONE) {
      throw new Error(`Ya tenés turnos esperando la transferencia en ${tenant.name}. Mandá esos comprobantes (o esperá a que venzan) antes de reservar otro.`);
    }

    const servicePrice = Number(service.data()!.price ?? 0);
    const depositDue = depositFor(tenant, servicePrice);
    if (depositDue <= 0) throw new Error("La reserva online requiere una seña configurada");

    const transferExpiresAt = Timestamp.fromDate(deadline);
    expiresAtISO = deadline.toISOString();
    transaction.create(appointmentRef, {
      id: appointmentRef.id, token, tenantId: tenant.id,
      staffId: holdData.staffId, staffName: staff.data()?.displayName ?? "", staffPhoto: staff.data()?.photoUrl ?? null,
      // Sin ficha hasta que la dueña confirme (ver comentario de arriba).
      clientId: null, clientName: client.fullName, clientPhoto: null,
      clientPhone: client.phone, clientEmail: client.email || null,
      pendingClient: { fullName: client.fullName, phone: client.phone, email: client.email || null },
      transferPhoneKey: phoneKey,
      startsAt: holdData.startsAt, endsAt: holdData.endsAt,
      status: "pending_payment", total: servicePrice, balance: servicePrice, depositPaid: 0,
      depositDue, awaitingTransfer: true, transferExpiresAt, source: "public_transfer",
      items: [{ serviceId: holdData.serviceId, name: service.data()?.name ?? "Servicio", price: servicePrice }],
      rescheduledFromId: null, cancelReason: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    occupancyRefs.forEach((ref) => transaction.set(ref, { appointmentId: appointmentRef.id, tenantId: tenant.id }));
    transaction.delete(holdRef);
    transaction.set(pendingTransferRef(tenant.id, appointmentRef.id), {
      tenantId: tenant.id, appointmentId: appointmentRef.id, phoneKey,
      expiresAt: transferExpiresAt, createdAt: FieldValue.serverTimestamp(),
    });
    // Alta en el contador + limpieza de las entradas ya vencidas.
    const counterUpdate: Record<string, unknown> = { [appointmentRef.id]: deadline.getTime() };
    for (const id of Object.keys(counterEntries ?? {})) {
      if (!activeForPhone.has(id)) counterUpdate[id] = FieldValue.delete();
    }
    transaction.set(phoneCounterRef, { tenantId: tenant.id, active: counterUpdate, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { token, appointmentId: appointmentRef.id, expiresAt: expiresAtISO };
}

export type TransferInstructions = {
  appointmentId: string;
  status: string;
  awaitingTransfer: boolean;
  clientName: string;
  serviceName: string;
  startsAt: string;
  depositDue: number;
  expiresAt: string | null;
  transfer: Pick<TransferSettings, "alias" | "cbu" | "holderName" | "bankName"> | null;
  whatsappNumber: string | null;
};

/** Datos para la pantalla "Transferí la seña" (y el aviso en Mi turno). */
export async function getTransferInstructions(tenant: TenantRecord, token: string): Promise<TransferInstructions | null> {
  if (typeof token !== "string" || !ID_PATTERN.test(token)) return null;
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments")
    .where("token", "==", token).limit(1).get();
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  if (data.source !== "public_transfer") return null;
  const transfer = tenant.settings.payments?.transfer;
  return {
    appointmentId: snapshot.docs[0].id,
    status: String(data.status),
    awaitingTransfer: data.awaitingTransfer === true,
    clientName: String(data.clientName ?? ""),
    serviceName: Array.isArray(data.items) ? data.items.map((item: { name?: string }) => item.name ?? "").join(", ") : "Turno",
    startsAt: data.startsAt?.toDate?.().toISOString?.() ?? "",
    depositDue: Number(data.depositDue ?? 0),
    expiresAt: data.transferExpiresAt?.toDate?.().toISOString?.() ?? null,
    transfer: transfer?.alias ? { alias: transfer.alias, cbu: transfer.cbu ?? null, holderName: transfer.holderName, bankName: transfer.bankName ?? null } : null,
    whatsappNumber: tenant.whatsappNumber ?? null,
  };
}

export type ConfirmTransferResult = "confirmed" | "already_confirmed";

type PendingClient = { fullName: string; phone: string; email: string | null };

function pendingClientOf(data: DocumentData): PendingClient | null {
  const source = (data.pendingClient ?? {}) as Partial<PendingClient>;
  const fullName = String(source.fullName ?? data.clientName ?? "").trim();
  const phone = String(source.phone ?? data.clientPhone ?? "").trim();
  if (!fullName || !phone.replace(/\D/g, "")) return null;
  const email = source.email ?? data.clientEmail ?? null;
  return { fullName, phone, email: typeof email === "string" && email ? email : null };
}

/**
 * La dueña vio el comprobante: registra la seña (transferencia), confirma el
 * turno y recién ahí busca (por teléfono) o crea la ficha de la clienta y le
 * suma la visita y la plata. Idempotente: un doble toque (o dos
 * dispositivos) no duplica el pago.
 */
export async function confirmTransferDeposit(input: { tenantId: string; timezone: string; appointmentId: string; changedBy: string }): Promise<ConfirmTransferResult> {
  if (!ID_PATTERN.test(input.appointmentId)) throw new Error("El turno no existe");
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(input.appointmentId);
  const result = await db.runTransaction<ConfirmTransferResult>(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists) throw new Error("El turno no existe");
    const data = snapshot.data()!;
    if (data.status === "confirmed" && data.transferConfirmedAt) {
      endTransferWait(transaction, input.tenantId, input.appointmentId, data);
      return "already_confirmed";
    }
    if (data.status !== "pending_payment" || data.awaitingTransfer !== true) {
      throw new Error(data.status === "cancelled"
        ? "Este turno ya se canceló (se rechazó o venció el plazo). Si la clienta pagó, agendalo de nuevo desde la agenda."
        : "Este turno ya no está esperando una transferencia");
    }
    const amount = roundMoney(Number(data.depositDue ?? 0));
    if (amount <= 0) throw new Error("El turno no tiene una seña para confirmar");
    const total = Number(data.total ?? 0);

    // Ficha: la que ya tenía el turno (reservas de antes de este cambio) o
    // la del teléfono; si no hay ninguna, se crea con lo que cargó en el turnero.
    let clientId = typeof data.clientId === "string" && data.clientId ? data.clientId : null;
    let newClient: PendingClient | null = null;
    let createPhoneIndex: FirebaseFirestore.DocumentReference | null = null;
    let clientPhoto: string | null = null;
    if (!clientId) {
      const pendingClient = pendingClientOf(data);
      if (!pendingClient) throw new Error("Al turno le faltan el nombre o el WhatsApp de la clienta");
      const phoneRef = db.collection("tenantClientPhones").doc(tenantPhoneKey(input.tenantId, pendingClient.phone));
      const phone = await transaction.get(phoneRef);
      if (phone.exists && phone.data()?.clientId) {
        clientId = String(phone.data()!.clientId);
        const existing = await transaction.get(tenantRef.collection("clients").doc(clientId));
        if (existing.exists) clientPhoto = (existing.data()?.photoUrl as string | null | undefined) ?? null;
        else newClient = pendingClient; // índice de teléfono huérfano: se rearma la ficha con ese id.
      } else {
        clientId = tenantRef.collection("clients").doc().id;
        newClient = pendingClient;
        createPhoneIndex = phoneRef;
      }
    }
    const clientRef = tenantRef.collection("clients").doc(clientId);

    const paymentRef = appointmentRef.collection("payments").doc();
    transaction.create(paymentRef, paymentDocument({
      id: paymentRef.id, kind: "deposit", method: "transfer", status: "approved",
      grossAmount: amount, appliedAmount: amount, feeAmount: 0, surchargeAmount: 0, netAmount: amount,
      paidAt: new Date(), source: "admin", tenantId: input.tenantId, appointmentId: input.appointmentId,
    }));
    transaction.update(appointmentRef, {
      status: "confirmed", depositPaid: amount, balance: Math.max(0, roundMoney(total - amount)),
      awaitingTransfer: false, transferConfirmedAt: FieldValue.serverTimestamp(), transferConfirmedBy: input.changedBy,
      clientId,
      ...(data.clientId ? {} : { clientPhoto }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (newClient) {
      transaction.set(clientRef, {
        id: clientId, tenantId: input.tenantId, fullName: newClient.fullName,
        fullNameNormalized: newClient.fullName.toLocaleLowerCase("es-AR"),
        phoneE164: newClient.phone, email: newClient.email,
        noShowCount: 0, appointmentsCount: 1, totalSpent: amount,
        lastVisitAt: null, archivedAt: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (createPhoneIndex) transaction.create(createPhoneIndex, { tenantId: input.tenantId, clientId, createdAt: FieldValue.serverTimestamp() });
    } else {
      transaction.set(clientRef, {
        appointmentsCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const historyRef = appointmentRef.collection("statusHistory").doc();
    transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "confirmed", reason: "Seña por transferencia recibida", depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
    endTransferWait(transaction, input.tenantId, input.appointmentId, data);
    return "confirmed";
  });
  if (result === "confirmed") {
    try {
      await recordTrustedAnalyticsEvent({ tenantId: input.tenantId, timezone: input.timezone, event: "appointmentConfirmed" });
    } catch {
      // Las métricas nunca bloquean la confirmación del turno.
    }
  }
  return result;
}

type CancelMode = "owner" | "expire";

/**
 * Cancela (en una sola transacción) un turno que esperaba transferencia:
 * libera la ocupación, deja el historial y termina la espera (pendiente +
 * contador). Idempotente: si ya no esperaba nada, solo limpia el pendiente.
 * - owner: si el turno ya se confirmó por otro lado, avisa en vez de cancelarlo.
 * - expire (cron): solo cancela si el plazo del turno realmente venció.
 */
async function cancelInTransaction(transaction: Transaction, input: { tenantId: string; appointmentId: string; reason: string; changedBy: string; mode: CancelMode }) {
  const tenantRef = firebaseAdmin().db.collection("tenants").doc(input.tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(input.appointmentId);
  const snapshot = await transaction.get(appointmentRef);
  const data = snapshot.data();
  const pending = Boolean(data && data.status === "pending_payment" && data.awaitingTransfer === true);
  if (!pending || !data) {
    if (input.mode === "owner" && data && data.status !== "cancelled") throw new Error("Este turno ya no está esperando una transferencia");
    endTransferWait(transaction, input.tenantId, input.appointmentId, data);
    return false;
  }
  if (input.mode === "expire") {
    const expiresAt = data.transferExpiresAt?.toMillis?.();
    if (typeof expiresAt === "number" && expiresAt > Date.now()) return false;
  }
  const startsAt: Date = data.startsAt.toDate();
  const durationMin = Math.round((data.endsAt.toDate().getTime() - startsAt.getTime()) / 60_000);
  const slotRefs = occupancySlotInstants(startsAt, durationMin).map((instant) =>
    tenantRef.collection("occupancy").doc(occupancyDocId(String(data.staffId), instant)),
  );
  const slots = await transaction.getAll(...slotRefs);
  slots.forEach((slot) => {
    if (slot.exists && slot.data()?.appointmentId === input.appointmentId) transaction.delete(slot.ref);
  });
  transaction.update(appointmentRef, {
    status: "cancelled", cancelReason: input.reason, awaitingTransfer: false,
    cancelSource: input.mode === "expire" ? "transfer_expired" : "transfer_rejected",
    cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const historyRef = appointmentRef.collection("statusHistory").doc();
  transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "cancelled", reason: input.reason, depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
  endTransferWait(transaction, input.tenantId, input.appointmentId, data);
  return true;
}

/** La dueña rechaza la transferencia (no llegó / no coincide): cancela y libera el horario. */
export async function cancelPendingTransfer(input: { tenantId: string; appointmentId: string; reason: string; changedBy: string }) {
  if (!ID_PATTERN.test(input.appointmentId)) throw new Error("El turno no existe");
  return firebaseAdmin().db.runTransaction((transaction) => cancelInTransaction(transaction, { ...input, mode: "owner" }));
}

/**
 * Llamado por el cron: los turnos sin comprobante confirmado a tiempo se
 * cancelan solos. Un pendiente que falla (turno con datos rotos) suma
 * `expireAttempts`; al llegar a MAX_EXPIRE_ATTEMPTS se saca de la cola y se
 * marca el turno, así unos pocos rotos no bloquean el lote para siempre.
 */
export async function expirePendingTransfers(limit = 50) {
  const db = firebaseAdmin().db;
  const expired = await db.collection("pendingTransfers").where("expiresAt", "<", Timestamp.now()).limit(limit).get();
  let cancelled = 0;
  for (const doc of expired.docs) {
    const { tenantId, appointmentId, expireAttempts } = doc.data() as { tenantId?: string; appointmentId?: string; expireAttempts?: number };
    if (!tenantId || !appointmentId || !ID_PATTERN.test(tenantId) || !ID_PATTERN.test(appointmentId)) {
      await doc.ref.delete();
      continue;
    }
    try {
      const didCancel = await db.runTransaction((transaction) => cancelInTransaction(transaction, {
        tenantId, appointmentId, mode: "expire", changedBy: "system",
        reason: "No se confirmó la transferencia de la seña a tiempo",
      }));
      if (didCancel) cancelled += 1;
    } catch (error) {
      const attempts = Number(expireAttempts ?? 0) + 1;
      const message = error instanceof Error ? error.message.slice(0, 300) : "Error desconocido";
      console.error("[transfer] no se pudo vencer", doc.id, `intento ${attempts}`, error);
      try {
        if (attempts >= MAX_EXPIRE_ATTEMPTS) {
          // Se saca de la cola y se deja la marca en el turno para revisarlo a mano.
          await Promise.all([
            doc.ref.delete(),
            db.collection("tenants").doc(tenantId).collection("appointments").doc(appointmentId)
              .set({ transferExpireFailed: true, transferExpireError: message, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
          ]);
        } else {
          await doc.ref.update({ expireAttempts: attempts, lastExpireError: message });
        }
      } catch (flagError) {
        console.error("[transfer] no se pudo marcar el pendiente roto", doc.id, flagError);
      }
    }
  }
  return cancelled;
}

export type PendingTransferRow = {
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  startsAt: Date;
  depositDue: number;
  expiresAt: Date | null;
  createdAt: Date | null;
};

/**
 * Lista de la dueña (/transferencias): más nuevas primero. Pocas por local
 * (hay tope), se ordena en memoria. Solo cuenta un pendiente si su turno
 * existe y de verdad sigue esperando la transferencia.
 */
export async function listPendingTransfers(tenantId: string, limit = 100): Promise<PendingTransferRow[]> {
  const db = firebaseAdmin().db;
  const pending = await db.collection("pendingTransfers").where("tenantId", "==", tenantId).limit(limit).get();
  if (pending.empty) return [];
  const tenantRef = db.collection("tenants").doc(tenantId);
  const refs = pending.docs
    .map((doc) => String(doc.data().appointmentId ?? ""))
    .filter((id) => ID_PATTERN.test(id))
    .map((id) => tenantRef.collection("appointments").doc(id));
  if (refs.length === 0) return [];
  const appointments = await db.getAll(...refs);
  return appointments
    .filter((snapshot) => snapshot.exists && snapshot.data()?.awaitingTransfer === true && snapshot.data()?.status === "pending_payment" && snapshot.data()?.startsAt?.toDate)
    .map((snapshot) => {
      const data = snapshot.data()!;
      return {
        appointmentId: snapshot.id,
        clientName: String(data.clientName ?? ""),
        clientPhone: String(data.clientPhone ?? ""),
        serviceName: Array.isArray(data.items) ? data.items.map((item: { name?: string }) => item.name ?? "").join(", ") : "Turno",
        startsAt: data.startsAt.toDate(),
        depositDue: Number(data.depositDue ?? 0),
        expiresAt: data.transferExpiresAt?.toDate?.() ?? null,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/**
 * Badge del home: la misma lógica que la lista de /transferencias (no un
 * count() crudo de la colección), así el número y la lista nunca difieren.
 * Barato: hay un tope de pendientes por local.
 */
export async function countPendingTransfers(tenantId: string): Promise<number> {
  return (await listPendingTransfers(tenantId)).length;
}
