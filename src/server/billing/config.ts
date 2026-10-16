import "server-only";
import { cache } from "react";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { parseBillingConfig, validateBillingConfigPatch, type BillingConfig } from "./model";

export type { BillingConfig } from "./model";
export { DEFAULT_BILLING_CONFIG } from "./model";

/** Doc global de la suscripción: precios por plan, alta free/trial, días de prueba y de gracia. */
export const BILLING_CONFIG_DOC = { collection: "platformConfig", id: "billing" } as const;

function configRef() {
  return firebaseAdmin().db.collection(BILLING_CONFIG_DOC.collection).doc(BILLING_CONFIG_DOC.id);
}

/**
 * Config vigente (platformConfig/billing) con defaults para lo que falte:
 * precios DEFAULT_PLAN_PRICES_ARS, alta "free", 15 días de prueba, 3 de gracia.
 * Cacheada por request.
 */
export const getBillingConfig = cache(async (): Promise<BillingConfig> => {
  const snapshot = await configRef().get();
  return parseBillingConfig(snapshot.exists ? snapshot.data() : null);
});

/**
 * Guarda un cambio parcial desde /platform. Valida: precios enteros
 * 1..10.000.000, trialDays 1..365, graceDays 0..30 (tira con el mensaje para la UI).
 * Los precios nuevos aplican a las suscripciones que se creen desde ahora;
 * las de MP ya autorizadas siguen con su monto hasta que cambien de plan.
 */
export async function saveBillingConfig(patch: Partial<BillingConfig>): Promise<void> {
  const clean = validateBillingConfigPatch(patch);
  if (Object.keys(clean).length === 0) return;
  // merge: true mezcla el mapa `prices` campo por campo (un precio no pisa los otros).
  await configRef().set({ ...clean, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
