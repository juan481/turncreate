"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { TenantBilling } from "@/lib/billing";
import { PLANS } from "@/lib/plans";
import { firebaseAdmin } from "@/server/firebase/admin";
import { readTenantBilling } from "@/server/billing/tenant-billing";
import { cancelSubscription, syncSubscription } from "@/server/billing/subscriptions";
import {
  PlatformActionError,
  failure,
  platformActor,
  revalidateTenantViews,
  type PlatformActionResult,
} from "@/server/platform/action-support";
import { auditEntryData, newAuditRef } from "@/server/platform/audit";
import {
  billingReasonRequired,
  inclusiveEndLabel,
  parseBillingRequest,
  planBillingChange,
  type BillingChange,
  type BillingPatch,
} from "@/server/platform/billing-model";
import { isValidTenantId, validateReason } from "@/server/platform/model";

/** ms -> Timestamp; null se escribe como null (TenantBilling admite null en las fechas). */
function toFirestoreDate(value: number | null): Timestamp | null {
  return value == null ? null : Timestamp.fromMillis(value);
}

/** Field paths con punto: nunca se pisa el resto de `billing` (preapproval de MP, payerEmail...). */
function billingUpdate(patch: BillingPatch, actorEmail: string): Record<string, unknown> {
  const update: Record<string, unknown> = {
    "billing.updatedAt": FieldValue.serverTimestamp(),
    "billing.updatedBy": actorEmail,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (patch.status !== undefined) update["billing.status"] = patch.status;
  if (patch.plan !== undefined) {
    update["billing.plan"] = patch.plan;
    // planFeatures() (tope de profesionales, caja) lee `tenant.plan`: van juntos.
    update.plan = patch.plan;
  }
  if (patch.trialEndsAt !== undefined) update["billing.trialEndsAt"] = toFirestoreDate(patch.trialEndsAt);
  if (patch.currentPeriodEnd !== undefined) update["billing.currentPeriodEnd"] = toFirestoreDate(patch.currentPeriodEnd);
  if (patch.cancelledAt !== undefined) update["billing.cancelledAt"] = toFirestoreDate(patch.cancelledAt);
  return update;
}

function successMessage(name: string, change: BillingChange): string {
  const { action, patch } = change;
  switch (action) {
    case "billing.free":
      return `${name} quedó como cortesía`;
    case "billing.trial":
      return `${name} quedó en prueba hasta el ${inclusiveEndLabel(patch.trialEndsAt)}`;
    case "billing.extend":
      return `Prueba de ${name} extendida hasta el ${inclusiveEndLabel(patch.trialEndsAt)}`;
    case "billing.plan":
      return `${name} pasó al plan ${patch.plan ? PLANS[patch.plan].name : ""}`.trim();
    case "billing.unpaid":
      return `${name} quedó interrumpido por falta de pago`;
    case "billing.reactivate":
      return `${name} quedó reactivado`;
    case "billing.cancel":
      return `${name} quedó dado de baja`;
  }
}

function hasLivePreapproval(billing: TenantBilling | null): billing is TenantBilling & { mpPreapprovalId: string } {
  return Boolean(billing?.mpPreapprovalId) && billing?.mpPreapprovalStatus !== "cancelled";
}

/**
 * Cambiar la suscripción de un local desde /platform: cortesía, prueba,
 * extender, plan, interrumpir por falta de pago, reactivar o dar de baja
 * (cada uno con su acción de auditoría `billing.*`). La pantalla manda lo
 * que QUIERE, nunca el estado actual: se relee dentro de la transacción y
 * planBillingChange() decide si se puede. Interrumpir y dar de baja exigen
 * motivo.
 *
 * Dar de baja con una suscripción de Mercado Pago viva la cancela PRIMERO
 * en MP: si MP falla no se da de baja nada (peor sería cortarle el servicio
 * y que le sigan cobrando).
 */
export async function changeTenantBillingAction(
  tenantId: string,
  rawRequest: unknown,
  reason?: string | null,
): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };
  const parsed = parseBillingRequest(rawRequest);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const request = parsed.value;
  const required = billingReasonRequired(request.kind);
  if (required && (typeof reason !== "string" || !reason.trim())) {
    return { ok: false, error: "Contá el motivo: queda en la auditoría" };
  }
  const reasonCheck = validateReason(reason, required);
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);

  let mpCancelled: { id: string; fromStatus: TenantBilling["status"] } | null = null;
  if (request.kind === "cancel") {
    try {
      const snapshot = await tenantRef.get();
      if (!snapshot.exists) return { ok: false, error: "El local no existe" };
      const billing = (await readTenantBilling(snapshot.data() ?? {})) ?? null;
      if (billing?.status === "cancelled") return { ok: false, error: "Ya estaba dado de baja" };
      if (hasLivePreapproval(billing)) {
        await cancelSubscription(tenantId);
        mpCancelled = { id: billing.mpPreapprovalId, fromStatus: billing.status };
      }
    } catch (error) {
      console.error("[platform] cancelSubscription", tenantId, error);
      return { ok: false, error: "No se pudo cancelar la suscripción en Mercado Pago, así que no se dio de baja. Probá de nuevo en un rato." };
    }
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(tenantRef);
      if (!snapshot.exists) throw new PlatformActionError("El local no existe");
      const data = snapshot.data() ?? {};
      const billing = (await readTenantBilling(data)) ?? null;
      const now = new Date();
      let change = planBillingChange(billing, data.plan, request, now);
      // cancelSubscription() puede haber dejado ya `billing.status = cancelled`:
      // la baja igual se completa y se audita desde el estado de antes.
      if (!change.ok && mpCancelled && billing?.status === "cancelled") {
        change = {
          ok: true,
          value: {
            patch: { status: "cancelled", cancelledAt: billing.cancelledAt ?? now.getTime() },
            action: "billing.cancel",
            from: mpCancelled.fromStatus,
            to: "cancelled",
            detail: null,
          },
        };
      }
      if (!change.ok) throw new PlatformActionError(change.error);
      const value = change.value;
      const detail = mpCancelled
        ? [value.detail, `También se canceló la suscripción de Mercado Pago (${mpCancelled.id})`].filter(Boolean).join(" · ")
        : value.detail;
      const name = String(data.name ?? "");

      transaction.update(tenantRef, billingUpdate(value.patch, actor.email));
      transaction.create(newAuditRef(), auditEntryData({
        actorEmail: actor.email,
        actorUid: actor.uid,
        tenantId,
        tenantName: name,
        action: value.action,
        from: value.from,
        to: value.to,
        reason: reasonCheck.value,
        detail,
      }));
      return { name, slug: String(data.slug ?? ""), change: value };
    });
    revalidateTenantViews(tenantId, result.slug);
    return { ok: true, message: successMessage(result.name, result.change) };
  } catch (error) {
    if (mpCancelled) {
      console.error("[platform] la suscripción de MP se canceló pero la baja no se guardó", tenantId, error);
      return { ok: false, error: "Se canceló la suscripción en Mercado Pago pero no se pudo guardar la baja: volvé a tocar Dar de baja" };
    }
    return failure(error, "No se pudo cambiar la suscripción");
  }
}

/**
 * Traer de Mercado Pago el estado real de la suscripción (preapproval) y
 * guardarlo (lo hace syncSubscription). Se audita el antes/después.
 */
export async function syncTenantSubscriptionAction(tenantId: string): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  try {
    const before = await tenantRef.get();
    if (!before.exists) throw new PlatformActionError("El local no existe");
    const beforeBilling = (await readTenantBilling(before.data() ?? {})) ?? null;
    if (!beforeBilling?.mpPreapprovalId) throw new PlatformActionError("Este local no tiene una suscripción de Mercado Pago");

    try {
      await syncSubscription(tenantId);
    } catch (error) {
      console.error("[platform] syncSubscription", tenantId, error);
      throw new PlatformActionError("Mercado Pago no respondió: probá de nuevo en un rato");
    }

    const after = await tenantRef.get();
    const data = after.data() ?? {};
    const afterBilling = (await readTenantBilling(data)) ?? null;
    const name = String(data.name ?? "");
    const fromStatus = beforeBilling.status;
    const toStatus = afterBilling?.status ?? fromStatus;
    await newAuditRef().create(auditEntryData({
      actorEmail: actor.email,
      actorUid: actor.uid,
      tenantId,
      tenantName: name,
      action: "billing.sync",
      from: fromStatus,
      to: toStatus,
      reason: null,
      detail: `Mercado Pago: ${beforeBilling.mpPreapprovalStatus ?? "sin estado"} → ${afterBilling?.mpPreapprovalStatus ?? "sin estado"}`,
    }));
    revalidateTenantViews(tenantId, String(data.slug ?? ""));
    return {
      ok: true,
      message: fromStatus === toStatus ? "Sincronizado: no hubo cambios" : "Sincronizado con Mercado Pago",
    };
  } catch (error) {
    return failure(error, "No se pudo sincronizar con Mercado Pago");
  }
}
