import "server-only";
import crypto from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { calculateDeposit } from "@/domain/money/deposit";
import { paymentDocument, roundMoney } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase, type TenantRecord, type TransferSettings } from "@/server/firebase/tenants";
import { recordTrustedAnalyticsEvent } from "@/server/analytics";
import { cleanPublicClient, tenantPhoneKey, type PublicClientInput } from "./client";
import {
  isTransferReady,
  MAX_PENDING_TRANSFERS_PER_PHONE,
  TRANSFER_MIN_LEAD_HOURS,
  transferDeadline,
} from "./payment-methods";

/**
 * Seña por transferencia bancaria. El turno se crea como `pending_payment`
 * (el mismo estado "pendiente" que ya entienden agenda, caja y stats) con
 * `awaitingTransfer: true`: ocupa el horario igual que uno confirmado, no
 * suma plata ni cuenta como visita de la clienta, y queda así hasta que la
 * dueña confirma el comprobante (o lo rechaza, o vence). Cada turno
 * pendiente tiene además un documento en `pendingTransfers` (colección raíz,
 * filtros de un solo campo: tenantId / phoneKey / expiresAt) para que el
 * cron, la lista de la dueña y el tope por teléfono no dependan de índices
 * compuestos ni de collection group.
 *
 * Contadores de la ficha (appointmentsCount, totalSpent): se suman recién
 * al confirmar. Así un turno que nunca se paga no infla la ficha, y
 * cancelar/vencer no tiene nada que revertir.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function pendingTransferRef(tenantId: string, appointmentId: string) {
  return firebaseAdmin().db.collection("pendingTransfers").doc(`${tenantId}_${appointmentId}`);
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

    // Tope por WhatsApp: sin esto, alguien podría bloquear media agenda
    // reservando "por transferencia" sin pagar nunca.
    const openForPhone = await transaction.get(db.collection("pendingTransfers").where("phoneKey", "==", phoneKey).limit(10));
    const activeForPhone = openForPhone.docs.filter((doc) => (doc.data().expiresAt?.toMillis?.() ?? 0) > now).length;
    if (activeForPhone >= MAX_PENDING_TRANSFERS_PER_PHONE) {
      throw new Error(`Ya tenés ${activeForPhone} turnos esperando la transferencia en ${tenant.name}. Mandá esos comprobantes (o esperá a que venzan) antes de reservar otro.`);
    }

    const phoneRef = db.collection("tenantClientPhones").doc(phoneKey);
    const phone = await transaction.get(phoneRef);
    const clientId = phone.exists ? String(phone.data()!.clientId) : tenantRef.collection("clients").doc().id;
    const clientRef = tenantRef.collection("clients").doc(clientId);
    const existingClient = phone.exists ? await transaction.get(clientRef) : null;

    const servicePrice = Number(service.data()!.price ?? 0);
    const depositDue = depositFor(tenant, servicePrice);
    if (depositDue <= 0) throw new Error("La reserva online requiere una seña configurada");

    // Una clienta que ya existe NO se toca: el nombre/email que escribió
    // alguien en el turnero público no pisa la ficha que armó la dueña.
    if (!existingClient?.exists) {
      transaction.set(clientRef, {
        id: clientId, tenantId: tenant.id, fullName: client.fullName,
        fullNameNormalized: client.fullName.toLocaleLowerCase("es-AR"),
        phoneE164: client.phone, email: client.email || null,
        noShowCount: 0, appointmentsCount: 0, totalSpent: 0,
        lastVisitAt: null, archivedAt: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (!phone.exists) transaction.create(phoneRef, { tenantId: tenant.id, clientId, createdAt: FieldValue.serverTimestamp() });
    }

    const transferExpiresAt = Timestamp.fromDate(deadline);
    expiresAtISO = deadline.toISOString();
    transaction.create(appointmentRef, {
      id: appointmentRef.id, token, tenantId: tenant.id,
      staffId: holdData.staffId, staffName: staff.data()?.displayName ?? "", staffPhoto: staff.data()?.photoUrl ?? null,
      clientId, clientName: client.fullName, clientPhoto: existingClient?.data()?.photoUrl ?? null,
      clientPhone: client.phone, clientEmail: client.email || null,
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

/**
 * La dueña vio el comprobante: registra la seña (transferencia), confirma el
 * turno y recién ahí suma la visita y la plata a la ficha de la clienta.
 * Idempotente: un doble toque (o dos dispositivos) no duplica el pago.
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
      transaction.delete(pendingTransferRef(input.tenantId, input.appointmentId));
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

    const paymentRef = appointmentRef.collection("payments").doc();
    transaction.create(paymentRef, paymentDocument({
      id: paymentRef.id, kind: "deposit", method: "transfer", status: "approved",
      grossAmount: amount, appliedAmount: amount, feeAmount: 0, surchargeAmount: 0, netAmount: amount,
      paidAt: new Date(), source: "admin", tenantId: input.tenantId, appointmentId: input.appointmentId,
    }));
    transaction.update(appointmentRef, {
      status: "confirmed", depositPaid: amount, balance: Math.max(0, roundMoney(total - amount)),
      awaitingTransfer: false, transferConfirmedAt: FieldValue.serverTimestamp(), transferConfirmedBy: input.changedBy,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (data.clientId) {
      transaction.set(tenantRef.collection("clients").doc(String(data.clientId)), {
        appointmentsCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const historyRef = appointmentRef.collection("statusHistory").doc();
    transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "confirmed", reason: "Seña por transferencia recibida", depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
    transaction.delete(pendingTransferRef(input.tenantId, input.appointmentId));
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
 * libera la ocupación, deja el historial y borra el pendiente. Idempotente:
 * si ya estaba cancelado no hace nada más que limpiar el pendiente.
 * - owner: si el turno ya se confirmó por otro lado, avisa en vez de cancelarlo.
 * - expire (cron): solo cancela si el plazo del turno realmente venció.
 */
async function cancelInTransaction(transaction: Transaction, input: { tenantId: string; appointmentId: string; reason: string; changedBy: string; mode: CancelMode }) {
  const tenantRef = firebaseAdmin().db.collection("tenants").doc(input.tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(input.appointmentId);
  const pendingRef = pendingTransferRef(input.tenantId, input.appointmentId);
  const snapshot = await transaction.get(appointmentRef);
  const data = snapshot.data();
  const pending = Boolean(data && data.status === "pending_payment" && data.awaitingTransfer === true);
  if (!pending || !data) {
    if (input.mode === "owner" && data && data.status !== "cancelled") throw new Error("Este turno ya no está esperando una transferencia");
    transaction.delete(pendingRef);
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
    cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  const historyRef = appointmentRef.collection("statusHistory").doc();
  transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "cancelled", reason: input.reason, depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
  transaction.delete(pendingRef);
  return true;
}

/** La dueña rechaza la transferencia (no llegó / no coincide): cancela y libera el horario. */
export async function cancelPendingTransfer(input: { tenantId: string; appointmentId: string; reason: string; changedBy: string }) {
  if (!ID_PATTERN.test(input.appointmentId)) throw new Error("El turno no existe");
  return firebaseAdmin().db.runTransaction((transaction) => cancelInTransaction(transaction, { ...input, mode: "owner" }));
}

/** Llamado por el cron: los turnos sin comprobante confirmado a tiempo se cancelan solos. */
export async function expirePendingTransfers(limit = 50) {
  const db = firebaseAdmin().db;
  const expired = await db.collection("pendingTransfers").where("expiresAt", "<", Timestamp.now()).limit(limit).get();
  let cancelled = 0;
  for (const doc of expired.docs) {
    const { tenantId, appointmentId } = doc.data() as { tenantId?: string; appointmentId?: string };
    if (!tenantId || !appointmentId) {
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
      // Uno roto no frena al resto; el próximo cron lo reintenta.
      console.error("[transfer] no se pudo vencer", doc.id, error);
    }
  }
  return cancelled;
}

/** Limpia el pendiente si el turno se canceló por otro camino (Mi turno, cambio de estado manual). */
export async function clearPendingTransfer(tenantId: string, appointmentId: string) {
  await pendingTransferRef(tenantId, appointmentId).delete();
}

/**
 * Señas por transferencia que esperan que la dueña confirme el comprobante
 * (badge del home). Filtro de un solo campo sobre la colección raíz.
 */
export async function countPendingTransfers(tenantId: string): Promise<number> {
  const snapshot = await firebaseAdmin().db.collection("pendingTransfers").where("tenantId", "==", tenantId).count().get();
  return snapshot.data().count;
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

/** Lista de la dueña (/transferencias): más nuevas primero. Pocas por local, se ordena en memoria. */
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
    .filter((snapshot) => snapshot.exists && snapshot.data()?.awaitingTransfer === true && snapshot.data()?.status === "pending_payment")
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
