import "server-only";
import { Invoice, MercadoPagoConfig, PreApproval } from "mercadopago";
import { toMillis, type AuthorizedPaymentSnapshot, type PreapprovalSnapshot } from "./model";

// Cliente de Mercado Pago de la cuenta de JUST CREATE (la que cobra la
// suscripción de los locales). Nada que ver con las cuentas vendedoras de los
// locales (OAuth, src/server/mercadopago/connections.ts) que cobran señas.

export function platformAccessToken(): string | null {
  return process.env.MP_PLATFORM_ACCESS_TOKEN?.trim() || null;
}

/**
 * Seam de E2E/dev (mismo criterio que MP_E2E_STUB en mercadopago/checkout.ts):
 * nunca se pega contra MP, los preapproval son `e2e_...` y syncSubscription
 * simula la autorización + el primer cobro aprobado.
 */
export function isSubscriptionStub(): boolean {
  return process.env.MP_E2E_STUB === "1";
}

export const STUB_PREAPPROVAL_PREFIX = "e2e_";

function config(options?: { idempotencyKey?: string }) {
  const accessToken = platformAccessToken();
  if (!accessToken) throw new Error("El cobro de suscripciones con Mercado Pago no está configurado (MP_PLATFORM_ACCESS_TOKEN)");
  return new MercadoPagoConfig({ accessToken, options: { timeout: 10_000, ...options } });
}

export function preApprovalClient(options?: { idempotencyKey?: string }) {
  return new PreApproval(config(options));
}

export function invoiceClient() {
  return new Invoice(config());
}

type RawPreapproval = { id?: unknown; status?: unknown; next_payment_date?: unknown; payer_email?: unknown; external_reference?: unknown };

export function preapprovalSnapshot(raw: RawPreapproval): PreapprovalSnapshot & { externalReference: string | null } {
  if (raw.id == null || raw.id === "") throw new Error("Mercado Pago devolvió una suscripción sin id");
  return {
    id: String(raw.id),
    status: typeof raw.status === "string" ? raw.status : "unknown",
    nextPaymentDate: toMillis(raw.next_payment_date),
    payerEmail: typeof raw.payer_email === "string" && raw.payer_email ? raw.payer_email : null,
    externalReference: raw.external_reference != null ? String(raw.external_reference) : null,
  };
}

type RawInvoice = {
  id?: unknown;
  preapproval_id?: unknown;
  status?: unknown;
  payment?: { id?: unknown; status?: unknown } | null;
  transaction_amount?: unknown;
  currency_id?: unknown;
  debit_date?: unknown;
  date_created?: unknown;
  last_modified?: unknown;
  external_reference?: unknown;
};

export function authorizedPaymentSnapshot(raw: RawInvoice): AuthorizedPaymentSnapshot & { externalReference: string | null } {
  if (raw.id == null || raw.id === "") throw new Error("Mercado Pago devolvió una cuota sin id");
  return {
    id: String(raw.id),
    preapprovalId: raw.preapproval_id != null ? String(raw.preapproval_id) : null,
    status: typeof raw.status === "string" ? raw.status : "unknown",
    paymentId: raw.payment?.id != null ? String(raw.payment.id) : null,
    paymentStatus: typeof raw.payment?.status === "string" ? raw.payment.status : null,
    amount: Number(raw.transaction_amount ?? 0) || 0,
    currency: typeof raw.currency_id === "string" ? raw.currency_id : null,
    chargedAt: toMillis(raw.debit_date) ?? toMillis(raw.last_modified) ?? toMillis(raw.date_created),
    externalReference: raw.external_reference != null ? String(raw.external_reference) : null,
  };
}
