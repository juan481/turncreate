import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import type { TenantBilling } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/plans";
import { firebaseAdmin } from "@/server/firebase/admin";
import { isPublicHttpsUrl, mercadoPagoEnv } from "@/server/mercadopago/config";
import { getBillingConfig } from "./config";
import { invoiceClient, isSubscriptionStub, platformAccessToken, preApprovalClient, STUB_PREAPPROVAL_PREFIX } from "./mp";
import {
  addMonths,
  planCheckout,
  readTenantBilling,
  subscriptionExternalReference,
} from "./model";
import { billingPatchToUpdate, getTenantBilling, initialBillingFor } from "./tenant-billing";
import {
  applyAuthorizedPaymentSnapshot,
  applyPreapprovalSnapshot,
  syncAuthorizedPaymentFromMercadoPago,
  syncPreapprovalFromMercadoPago,
} from "./webhook";

// Suscripción mensual del local a TurnCreate con Mercado Pago "Suscripciones"
// (preapproval SIN plan, pago pendiente: la dueña entra al init_point, carga la
// tarjeta y MP debita solo cada mes) a la cuenta de MP de JUST CREATE.
//
// Baja (decisión): se cancela el preapproval en MP (no se cobra más) pero el
// local conserva lo que ya pagó: billing.status sigue "active" con
// `cancelAtPeriodEnd: true` hasta `currentPeriodEnd`, y ahí pasa directo a
// solo lectura (billingAccess → readonly, reason "cancelled").

/** true solo si está la credencial de la cuenta de Just Create (MP_PLATFORM_ACCESS_TOKEN). */
export function isSubscriptionCheckoutAvailable(): boolean {
  return Boolean(platformAccessToken());
}

type TenantDoc = { id: string; name: string; slug: string; status?: string; plan?: unknown; billing?: unknown };

async function loadTenant(tenantId: string): Promise<TenantDoc> {
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  if (!snapshot.exists) throw new Error("El local no existe");
  return { ...(snapshot.data() as Omit<TenantDoc, "id">), id: snapshot.id };
}

function appBaseUrl() {
  const appUrl = mercadoPagoEnv().appUrl;
  if (isSubscriptionStub()) return appUrl ?? "http://localhost:3000";
  if (!isPublicHttpsUrl(appUrl)) throw new Error("La suscripción requiere NEXT_PUBLIC_APP_URL con HTTPS público");
  return appUrl;
}

function planReason(plan: PlanId, tenantName: string) {
  // MP muestra el reason en el checkout y en el resumen de la tarjeta.
  return `TurnCreate · Plan ${PLANS[plan].name} · ${tenantName}`.slice(0, 250);
}

function isStubPreapproval(id: string | null | undefined) {
  return Boolean(id?.startsWith(STUB_PREAPPROVAL_PREFIX));
}

/** Cancela un preapproval en MP sin romper el flujo si ya estaba cancelado. */
async function cancelPreapprovalInMercadoPago(preapprovalId: string) {
  if (isSubscriptionStub() || isStubPreapproval(preapprovalId)) return;
  try {
    await preApprovalClient().update({ id: preapprovalId, body: { status: "cancelled" } });
  } catch (error) {
    const current = await preApprovalClient().get({ id: preapprovalId }).catch(() => null);
    if (current?.status !== "cancelled") throw error;
  }
}

/**
 * Arranca (o cambia) la suscripción del local al plan elegido.
 * - Sin suscripción viva: crea un preapproval sin plan con el precio vigente de
 *   platformConfig/billing; si le queda prueba o período pago, el primer débito
 *   arranca recién ahí (start_date). Devuelve el init_point de MP.
 * - Con suscripción autorizada y al día en otro plan: cambia el monto del mismo
 *   preapproval (no pasa por MP) y devuelve la URL de vuelta a Mi plan.
 * - Mismo plan ya activo: tira.
 * Guarda en tenants/{id}.billing: mpPreapprovalId, mpPreapprovalStatus,
 * payerEmail y plan (el estado cambia recién con el webhook).
 */
export async function createSubscriptionCheckout(input: { tenantId: string; plan: PlanId; payerEmail: string }): Promise<{ initPoint: string }> {
  const payerEmail = input.payerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) throw new Error("Email de Mercado Pago inválido");
  if (!(input.plan in PLANS)) throw new Error("Plan inválido");
  if (!isSubscriptionStub() && !isSubscriptionCheckoutAvailable()) throw new Error("El cobro de suscripciones todavía no está habilitado");

  const tenant = await loadTenant(input.tenantId);
  if (tenant.status === "suspended") throw new Error("Esta cuenta está suspendida. Escribinos para reactivarla.");
  const config = await getBillingConfig();
  const price = config.prices[input.plan];
  const now = Date.now();
  const current = readTenantBilling(tenant);
  const baseUrl = appBaseUrl();
  const tenantRef = firebaseAdmin().db.collection("tenants").doc(tenant.id);
  const decision = planCheckout(current, input.plan, now);

  if (decision.kind === "already_subscribed") throw new Error("Ya tenés este plan activo con débito automático");

  if (decision.kind === "change_plan") {
    if (!isSubscriptionStub() && !isStubPreapproval(decision.preapprovalId)) {
      await preApprovalClient({ idempotencyKey: `tcsub-chg-${tenant.id}-${input.plan}-${price}-${Math.floor(now / 60_000)}` }).update({
        id: decision.preapprovalId,
        body: { reason: planReason(input.plan, tenant.name), auto_recurring: { transaction_amount: price, currency_id: "ARS" } },
      });
    }
    await tenantRef.update({
      ...billingPatchToUpdate({ plan: input.plan }),
      "billing.mpPreapprovalAmount": price,
      "billing.updatedAt": FieldValue.serverTimestamp(),
    });
    return { initPoint: `${baseUrl}/app/${tenant.slug}/plan?mp=updated` };
  }

  if (decision.replacePreapprovalId) {
    // Un preapproval pendiente/pausado/con tarjeta rechazada que queda vivo
    // podría autorizarse o reanudarse después y cobrar dos veces.
    await cancelPreapprovalInMercadoPago(decision.replacePreapprovalId);
  }

  const backUrl = `${baseUrl}/app/${tenant.slug}/plan?mp=subscribed`;
  let preapprovalId: string;
  let preapprovalStatus: string;
  let initPoint: string;
  if (isSubscriptionStub()) {
    preapprovalId = `${STUB_PREAPPROVAL_PREFIX}${tenant.id}_${now}`;
    preapprovalStatus = "pending";
    initPoint = backUrl;
  } else {
    const response = await preApprovalClient({ idempotencyKey: `tcsub-${tenant.id}-${input.plan}-${price}-${Math.floor(now / 60_000)}` }).create({
      body: {
        reason: planReason(input.plan, tenant.name),
        external_reference: subscriptionExternalReference(tenant.id),
        payer_email: payerEmail,
        back_url: backUrl,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: price,
          currency_id: "ARS",
          ...(decision.startDate ? { start_date: new Date(decision.startDate).toISOString() } : {}),
        },
      },
    });
    if (!response.id || !response.init_point) throw new Error("Mercado Pago no devolvió un checkout de suscripción válido");
    preapprovalId = String(response.id);
    preapprovalStatus = response.status ?? "pending";
    initPoint = response.init_point;
  }

  const checkout = {
    mpPreapprovalId: preapprovalId,
    mpPreapprovalStatus: preapprovalStatus,
    payerEmail,
    plan: input.plan,
    mpPreapprovalAmount: price,
    checkoutStartedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await tenantRef.update(current
    // Locales anteriores a la suscripción (sin billing): arrancan su billing
    // como cortesía, así el webhook sabe qué plan eligieron.
    ? Object.fromEntries(Object.entries(checkout).map(([key, value]) => [`billing.${key}`, value]))
    : { billing: { ...initialBillingFor({ ...config, newTenantMode: "free" }, input.plan, now), ...checkout } });
  return { initPoint };
}

/**
 * Da de baja la suscripción: cancela el preapproval en MP y, si estaba al día,
 * deja `cancelAtPeriodEnd` (usa lo pagado hasta currentPeriodEnd). Sin
 * preapproval vivo no hay nada que cancelar en MP (no tira).
 */
export async function cancelSubscription(tenantId: string): Promise<void> {
  const tenant = await loadTenant(tenantId);
  const current = readTenantBilling(tenant);
  const preapprovalId = current?.mpPreapprovalId ?? null;
  if (preapprovalId && current?.mpPreapprovalStatus !== "cancelled") {
    await cancelPreapprovalInMercadoPago(preapprovalId);
  }
  const now = Date.now();
  const tenantRef = firebaseAdmin().db.collection("tenants").doc(tenantId);
  await firebaseAdmin().db.runTransaction(async (transaction) => {
    const fresh = readTenantBilling((await transaction.get(tenantRef)).data());
    if (!fresh) return;
    const patch: Partial<TenantBilling> = preapprovalId ? { mpPreapprovalStatus: "cancelled" } : {};
    if (fresh.status === "active" && !fresh.cancelAtPeriodEnd) {
      patch.cancelAtPeriodEnd = true;
      patch.cancelledAt = now;
    }
    if (Object.keys(patch).length === 0) return;
    transaction.update(tenantRef, { ...billingPatchToUpdate(patch), "billing.updatedAt": FieldValue.serverTimestamp() });
  });
}

/**
 * Re-lee de MP el preapproval del local y sus cuotas y aplica lo que falte
 * (por si se perdió un webhook; ideal al volver del checkout con ?mp=subscribed).
 * Idempotente. Con MP_E2E_STUB=1 simula la autorización + el primer cobro.
 */
export async function syncSubscription(tenantId: string): Promise<TenantBilling | null> {
  const current = await getTenantBilling(tenantId);
  const preapprovalId = current?.mpPreapprovalId;
  if (!current || !preapprovalId) return current;

  if (isStubPreapproval(preapprovalId)) {
    if (!isSubscriptionStub() || current.mpPreapprovalStatus !== "pending") return current;
    const now = Date.now();
    const nextPaymentDate = addMonths(now, 1);
    const config = await getBillingConfig();
    await applyPreapprovalSnapshot({ tenantId, preapproval: { id: preapprovalId, status: "authorized", nextPaymentDate: now, payerEmail: current.payerEmail ?? null } });
    await applyAuthorizedPaymentSnapshot({
      tenantId,
      nextPaymentDate,
      invoice: {
        id: `${preapprovalId}_1`, preapprovalId, status: "processed",
        paymentId: `${preapprovalId}_p1`, paymentStatus: "approved",
        amount: config.prices[current.plan], currency: "ARS", chargedAt: now,
      },
    });
    return getTenantBilling(tenantId);
  }

  await syncPreapprovalFromMercadoPago(preapprovalId, tenantId);
  const invoices = await invoiceClient().search({ options: { preapproval_id: preapprovalId, limit: 50 } });
  const ids = (invoices.results ?? [])
    .filter((invoice) => invoice.id != null)
    .sort((a, b) => String(a.date_created ?? "").localeCompare(String(b.date_created ?? "")))
    .map((invoice) => String(invoice.id));
  for (const id of ids) await syncAuthorizedPaymentFromMercadoPago(id, tenantId);
  return getTenantBilling(tenantId);
}

