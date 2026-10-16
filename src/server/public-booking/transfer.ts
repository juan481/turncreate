import "server-only";
import crypto from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { calculateDeposit } from "@/domain/money/deposit";
import { paymentDocument, roundMoney } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase, type TenantRecord, type TransferSettings } from "@/server/firebase/tenants";
import { recordTrustedAnalyticsEvent } from "@/server/analytics";
import { cleanPublicClient, type PublicClientInput } from "./client";
import { isTransferReady, TRANSFER_CONFIRM_WINDOW_HOURS } from "./payment-methods";

/**
 * Seña por transferencia bancaria. El turno se crea como `pending_payment`
 * (el mismo estado "pendiente" que ya entienden agenda, caja y stats) con
 * `awaitingTransfer: true`: ocupa el horario igual que uno confirmado, no
 * suma plata, y queda así hasta que la dueña confirma el comprobante desde
 * el detalle del turno. Cada turno pendiente tiene además un documento en
 * `pendingTransfers` (colección raíz, un solo campo de rango) para que el
 * cron lo encuentre al vencer sin depender de índices de collection group.
 */

const TRANSFER_WINDOW_MS = TRANSFER_CONFIRM_WINDOW_HOURS * 60 * 60_000;

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
  const client = cleanPublicClient(input.client);
  const tenant = await getTenantBySlugFromFirebase(input.slug);
  if (!tenant || tenant.status === "suspended") throw new Error("Este turnero no está disponible");
  if (!isTransferReady(tenant.settings.payments?.transfer)) throw new Error("Este local no recibe señas por transferencia");

  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(tenant.id);
  const holdRef = tenantRef.collection("holds").doc(input.holdId);
  const appointmentRef = tenantRef.collection("appointments").doc();
  const token = crypto.randomUUID().replace(/-/g, "");
  const transferExpiresAt = Timestamp.fromMillis(Date.now() + TRANSFER_WINDOW_MS);

  await db.runTransaction(async (transaction) => {
    const hold = await transaction.get(holdRef);
    if (!hold.exists || hold.data()!.expiresAt.toMillis() <= Date.now()) throw new Error("La reserva venció. Elegí el horario de nuevo.");
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

    const startsAt: Date = holdData.startsAt.toDate();
    const endsAt: Date = holdData.endsAt.toDate();
    const durationMin = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
    const occupancyRefs = occupancySlotInstants(startsAt, durationMin).map((instant) =>
      tenantRef.collection("occupancy").doc(occupancyDocId(String(holdData.staffId), instant)),
    );
    const occupancy = await transaction.getAll(...occupancyRefs);
    const now = Date.now();
    const free = occupancy.every((slot) => {
      if (!slot.exists) return true;
      const data = slot.data()!;
      if (data.holdId === holdRef.id) return true;
      const expiresAt = data.expiresAt?.toMillis?.();
      return typeof expiresAt === "number" && expiresAt < now;
    });
    if (!free) throw new Error("Ese horario ya no está disponible");

    const phoneRef = db.collection("tenantClientPhones").doc(`${tenant.id}_${client.phone.replace(/\D/g, "")}`);
    const phone = await transaction.get(phoneRef);
    const clientId = phone.exists ? String(phone.data()!.clientId) : tenantRef.collection("clients").doc().id;
    const clientRef = tenantRef.collection("clients").doc(clientId);
    const existingClient = phone.exists ? await transaction.get(clientRef) : null;

    const servicePrice = Number(service.data()!.price ?? 0);
    const depositDue = depositFor(tenant, servicePrice);
    if (depositDue <= 0) throw new Error("La reserva online requiere una seña configurada");

    if (!phone.exists || !existingClient?.exists) {
      transaction.set(clientRef, {
        id: clientId, tenantId: tenant.id, fullName: client.fullName,
        fullNameNormalized: client.fullName.toLocaleLowerCase("es-AR"),
        phoneE164: client.phone, email: client.email || null,
        noShowCount: 0, appointmentsCount: 1, totalSpent: 0,
        lastVisitAt: null, archivedAt: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      if (!phone.exists) transaction.create(phoneRef, { tenantId: tenant.id, clientId, createdAt: FieldValue.serverTimestamp() });
    } else {
      transaction.set(clientRef, {
        fullName: client.fullName,
        email: client.email || existingClient.data()?.email || null,
        appointmentsCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

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
      tenantId: tenant.id, appointmentId: appointmentRef.id, expiresAt: transferExpiresAt, createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { token };
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
    transfer: transfer ? { alias: transfer.alias, cbu: transfer.cbu ?? null, holderName: transfer.holderName, bankName: transfer.bankName ?? null } : null,
    whatsappNumber: tenant.whatsappNumber ?? null,
  };
}

/** La dueña vio el comprobante: registra la seña (transferencia) y confirma el turno. */
export async function confirmTransferDeposit(input: { tenantId: string; timezone: string; appointmentId: string; changedBy: string }) {
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(input.appointmentId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists) throw new Error("El turno no existe");
    const data = snapshot.data()!;
    if (data.status !== "pending_payment" || data.awaitingTransfer !== true) throw new Error("Este turno ya no está esperando una transferencia");
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
      transaction.set(tenantRef.collection("clients").doc(String(data.clientId)), { totalSpent: FieldValue.increment(amount), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    const historyRef = appointmentRef.collection("statusHistory").doc();
    transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "confirmed", reason: "Seña por transferencia recibida", depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
    transaction.delete(pendingTransferRef(input.tenantId, input.appointmentId));
  });
  try {
    await recordTrustedAnalyticsEvent({ tenantId: input.tenantId, timezone: input.timezone, event: "appointmentConfirmed" });
  } catch {
    // Las métricas nunca bloquean la confirmación del turno.
  }
}

async function cancelInTransaction(transaction: Transaction, input: { tenantId: string; appointmentId: string; reason: string; changedBy: string; strict: boolean }) {
  const tenantRef = firebaseAdmin().db.collection("tenants").doc(input.tenantId);
  const appointmentRef = tenantRef.collection("appointments").doc(input.appointmentId);
  const snapshot = await transaction.get(appointmentRef);
  const data = snapshot.data();
  const pending = Boolean(data && data.status === "pending_payment" && data.awaitingTransfer === true);
  if (!pending || !data) {
    if (input.strict) throw new Error("Este turno ya no está esperando una transferencia");
    transaction.delete(pendingTransferRef(input.tenantId, input.appointmentId));
    return false;
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
  transaction.update(appointmentRef, { status: "cancelled", cancelReason: input.reason, awaitingTransfer: false, updatedAt: FieldValue.serverTimestamp() });
  const historyRef = appointmentRef.collection("statusHistory").doc();
  transaction.create(historyRef, { id: historyRef.id, from: "pending_payment", to: "cancelled", reason: input.reason, depositDisposition: null, changedBy: input.changedBy, createdAt: FieldValue.serverTimestamp() });
  transaction.delete(pendingTransferRef(input.tenantId, input.appointmentId));
  return true;
}

/** Cancela un turno que esperaba transferencia y libera el horario. */
export async function cancelPendingTransfer(input: { tenantId: string; appointmentId: string; reason: string; changedBy: string }) {
  await firebaseAdmin().db.runTransaction((transaction) => cancelInTransaction(transaction, { ...input, strict: true }));
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
    const didCancel = await db.runTransaction((transaction) => cancelInTransaction(transaction, {
      tenantId, appointmentId, strict: false, changedBy: "system",
      reason: `No se confirmó la transferencia de la seña dentro de las ${TRANSFER_CONFIRM_WINDOW_HOURS} h`,
    }));
    if (didCancel) cancelled += 1;
  }
  return cancelled;
}

/** Limpia el pendiente si el turno se canceló por otro camino (Mi turno, cambio de estado manual). */
export async function clearPendingTransfer(tenantId: string, appointmentId: string) {
  await pendingTransferRef(tenantId, appointmentId).delete();
}
