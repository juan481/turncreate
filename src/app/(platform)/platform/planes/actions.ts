"use server";

import { revalidatePath } from "next/cache";
import { getBillingConfig, saveBillingConfig } from "@/server/billing/config";
import { failure, platformActor, PlatformActionError, type PlatformActionResult } from "@/server/platform/action-support";
import { auditEntryData, newAuditRef } from "@/server/platform/audit";
import { describeBillingConfigChange, parseBillingConfigInput } from "@/server/platform/billing-model";

/**
 * Precios por plan, qué reciben los locales nuevos (todo gratis o prueba
 * de N días) y los días de gracia: platformConfig/billing vía
 * saveBillingConfig(). La auditoría (config.billing, sin local) se escribe
 * después de guardar -- saveBillingConfig no corre dentro de una
 * transacción nuestra -- y solo si cambió algo.
 */
export async function saveBillingConfigAction(raw: unknown): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  const parsed = parseBillingConfigInput(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  try {
    const before = await getBillingConfig();
    const detail = describeBillingConfigChange(
      { prices: before.prices, newTenantMode: before.newTenantMode, trialDays: before.trialDays, graceDays: before.graceDays },
      parsed.value,
    );
    if (!detail) throw new PlatformActionError("No cambiaste nada");

    await saveBillingConfig(parsed.value);
    await newAuditRef().create(auditEntryData({
      actorEmail: actor.email,
      actorUid: actor.uid,
      tenantId: "",
      tenantName: "",
      action: "config.billing",
      from: "",
      to: "",
      reason: null,
      detail,
    }));

    revalidatePath("/platform/planes");
    revalidatePath("/platform/auditoria");
    revalidatePath("/platform", "layout");
    // La landing muestra estos precios y el "Empezá gratis / Probá N días".
    revalidatePath("/landing");
    revalidatePath("/");
    return { ok: true, message: "Precios y planes guardados" };
  } catch (error) {
    return failure(error, "No se pudieron guardar los precios");
  }
}
