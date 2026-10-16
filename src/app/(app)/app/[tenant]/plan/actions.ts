"use server";

import { revalidatePath } from "next/cache";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { cancelSubscription, createSubscriptionCheckout, isSubscriptionCheckoutAvailable } from "@/server/billing/subscriptions";
import { isPlanId } from "@/lib/plans";

export type PlanActionState = { error: string | null; initPoint?: string; cancelled?: boolean };

// Solo quien administra el local maneja lo que se le paga a Just Create.
const MANAGER_ROLES = new Set(["owner", "admin"]);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Pagar / dar de baja NO es "escribir datos del panel": un local
 * interrumpido por falta de pago tiene que poder pagar. Por eso
 * `{ write: false }` (el gate de solo-lectura no aplica acá).
 */
async function planManager(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  const { tenant, member } = await requireTenantAccess(user.uid, slug, { write: false });
  if (!MANAGER_ROLES.has(typeof member.role === "string" ? member.role : "")) {
    throw new Error("Solo la dueña o quien administra el local puede cambiar el plan.");
  }
  return { tenant };
}

export async function startSubscription(tenantSlug: string, _prev: PlanActionState, formData: FormData): Promise<PlanActionState> {
  const plan = formData.get("plan");
  if (!isPlanId(plan)) return { error: "Elegí un plan." };
  const payerEmail = String(formData.get("payerEmail") ?? "").trim().toLowerCase();
  if (!EMAIL.test(payerEmail)) return { error: "Revisá el email: tiene que ser el de tu cuenta de Mercado Pago." };
  if (!isSubscriptionCheckoutAvailable()) return { error: "El cobro con Mercado Pago se habilita muy pronto." };

  let tenantId: string;
  try {
    tenantId = (await planManager(tenantSlug)).tenant.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos verificar tu acceso al local." };
  }

  try {
    const { initPoint } = await createSubscriptionCheckout({ tenantId, plan, payerEmail });
    // El navegador va a salir a esta URL: solo https, nunca algo raro.
    if (!/^https:\/\//.test(initPoint)) throw new Error("initPoint inválido");
    return { error: null, initPoint };
  } catch (error) {
    console.error("[plan] createSubscriptionCheckout", error);
    return { error: "No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos." };
  }
}

export async function cancelPlanSubscription(tenantSlug: string): Promise<PlanActionState> {
  let tenantId: string;
  try {
    tenantId = (await planManager(tenantSlug)).tenant.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos verificar tu acceso al local." };
  }

  try {
    await cancelSubscription(tenantId);
  } catch (error) {
    console.error("[plan] cancelSubscription", error);
    return { error: "No pudimos cancelar la suscripción. Probá de nuevo en unos minutos o escribinos desde Ayuda." };
  }
  // El estado nuevo se ve en Mi plan, en los banners del layout y en el hub.
  revalidatePath(`/app/${tenantSlug}`, "layout");
  return { error: null, cancelled: true };
}
