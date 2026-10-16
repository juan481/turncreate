import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getBillingConfig } from "./config";
import { authorizedPaymentSnapshot, invoiceClient, preApprovalClient, preapprovalSnapshot } from "./mp";
import {
  authorizedPaymentTransition,
  billingEventId,
  preapprovalTransition,
  readTenantBilling,
  tenantIdFromExternalReference,
  type AuthorizedPaymentSnapshot,
  type PreapprovalSnapshot,
  type SubscriptionTopic,
} from "./model";
import { billingPatchToUpdate } from "./tenant-billing";

// Avisos de Mercado Pago de la suscripción de los locales (cuenta de Just
// Create). Nunca se confía en el body: se re-lee el recurso de MP con
// MP_PLATFORM_ACCESS_TOKEN. Cada estado de cada recurso se aplica UNA vez:
// billingEvents/{id} se crea en la misma transacción que el cambio del local.

export type BillingApplyResult = "applied" | "ignored" | "duplicate";

async function tenantExists(tenantId: string) {
  return (await firebaseAdmin().db.collection("tenants").doc(tenantId).get()).exists;
}

/** Aplica el estado de un preapproval al local (idempotente por id + estado + última modificación). */
export async function applyPreapprovalSnapshot(input: {
  tenantId: string;
  preapproval: PreapprovalSnapshot;
  /** Distingue dos avisos del mismo estado (MP manda `last_modified`). */
  version?: string | null;
  now?: number;
}): Promise<BillingApplyResult> {
  const now = input.now ?? Date.now();
  const { graceDays } = await getBillingConfig();
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const eventRef = db.collection("billingEvents").doc(billingEventId(["preapproval", input.preapproval.id, input.preapproval.status, input.version]));
  return db.runTransaction(async (transaction) => {
    const [event, tenant] = await Promise.all([transaction.get(eventRef), transaction.get(tenantRef)]);
    if (event.exists) return "duplicate" as const;
    if (!tenant.exists) return "ignored" as const;
    const patch = preapprovalTransition(readTenantBilling(tenant.data()), input.preapproval, now, graceDays);
    if (patch) {
      transaction.update(tenantRef, { ...billingPatchToUpdate(patch), "billing.updatedAt": FieldValue.serverTimestamp() });
    }
    transaction.create(eventRef, {
      kind: "preapproval",
      mpId: input.preapproval.id,
      tenantId: input.tenantId,
      status: input.preapproval.status,
      result: patch ? "applied" : "ignored",
      processedAt: FieldValue.serverTimestamp(),
    });
    return patch ? "applied" as const : "ignored" as const;
  });
}

/**
 * Aplica una cuota (authorized_payment) al local y la registra en
 * billingPayments/ap_{id} (un doc por cuota: si se rechazó y después se
 * cobró en un reintento, queda el estado final). Idempotente por cuota +
 * pago + estado del pago.
 */
export async function applyAuthorizedPaymentSnapshot(input: {
  tenantId: string;
  invoice: AuthorizedPaymentSnapshot;
  nextPaymentDate: number | null;
  now?: number;
}): Promise<BillingApplyResult> {
  const now = input.now ?? Date.now();
  const { graceDays } = await getBillingConfig();
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(input.tenantId);
  const { invoice } = input;
  const eventRef = db.collection("billingEvents").doc(billingEventId(["authorized_payment", invoice.id, invoice.paymentId, invoice.paymentStatus ?? invoice.status]));
  const paymentRef = db.collection("billingPayments").doc(billingEventId(["ap", invoice.id]));
  return db.runTransaction(async (transaction) => {
    const [event, tenant, existingPayment] = await Promise.all([transaction.get(eventRef), transaction.get(tenantRef), transaction.get(paymentRef)]);
    if (event.exists) return "duplicate" as const;
    if (!tenant.exists) return "ignored" as const;
    const current = readTenantBilling(tenant.data());
    const { patch, payment } = authorizedPaymentTransition(current, invoice, { now, graceDays, nextPaymentDate: input.nextPaymentDate });
    if (patch) {
      transaction.update(tenantRef, { ...billingPatchToUpdate(patch), "billing.updatedAt": FieldValue.serverTimestamp() });
    }
    // Una cuota ya cobrada no vuelve a "rechazada" por un aviso viejo de un reintento.
    if (payment && !(payment.status === "rejected" && existingPayment.data()?.status === "approved")) {
      transaction.set(paymentRef, {
        tenantId: input.tenantId,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        mpId: payment.mpId,
        mpPaymentId: payment.mpPaymentId,
        preapprovalId: payment.preapprovalId,
        plan: current?.plan ?? null,
        paidAt: Timestamp.fromMillis(payment.paidAt),
        createdAt: existingPayment.exists ? existingPayment.data()?.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    transaction.create(eventRef, {
      kind: "authorized_payment",
      mpId: invoice.id,
      mpPaymentId: invoice.paymentId,
      tenantId: input.tenantId,
      status: invoice.status,
      paymentStatus: invoice.paymentStatus,
      result: patch || payment ? "applied" : "ignored",
      processedAt: FieldValue.serverTimestamp(),
    });
    return patch || payment ? "applied" as const : "ignored" as const;
  });
}

/** Re-lee el preapproval de MP y lo aplica. */
export async function syncPreapprovalFromMercadoPago(preapprovalId: string, fallbackTenantId?: string): Promise<BillingApplyResult> {
  const raw = await preApprovalClient().get({ id: preapprovalId });
  const preapproval = preapprovalSnapshot(raw);
  const tenantId = tenantIdFromExternalReference(preapproval.externalReference) ?? fallbackTenantId ?? null;
  if (!tenantId || !(await tenantExists(tenantId))) return "ignored";
  const version = typeof raw.last_modified === "string" ? raw.last_modified : null;
  return applyPreapprovalSnapshot({ tenantId, preapproval, version });
}

/** Re-lee la cuota de MP (y su preapproval, para el tenant y next_payment_date) y la aplica. */
export async function syncAuthorizedPaymentFromMercadoPago(authorizedPaymentId: string, fallbackTenantId?: string): Promise<BillingApplyResult> {
  const invoice = authorizedPaymentSnapshot(await invoiceClient().get({ id: authorizedPaymentId }));
  const preapproval = invoice.preapprovalId ? preapprovalSnapshot(await preApprovalClient().get({ id: invoice.preapprovalId })) : null;
  const tenantId = tenantIdFromExternalReference(invoice.externalReference)
    ?? tenantIdFromExternalReference(preapproval?.externalReference)
    ?? fallbackTenantId
    ?? null;
  if (!tenantId || !(await tenantExists(tenantId))) return "ignored";
  return applyAuthorizedPaymentSnapshot({ tenantId, invoice, nextPaymentDate: preapproval?.nextPaymentDate ?? null });
}

/**
 * Entrada del webhook (ya con la firma validada). Tira si MP no responde:
 * la route devuelve 500 y MP reintenta.
 */
export async function handleSubscriptionNotification(input: { topic: SubscriptionTopic; id: string }): Promise<BillingApplyResult> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.id)) return "ignored";
  return input.topic === "preapproval"
    ? syncPreapprovalFromMercadoPago(input.id)
    : syncAuthorizedPaymentFromMercadoPago(input.id);
}
