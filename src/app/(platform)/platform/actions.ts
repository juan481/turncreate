"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requirePlatformAdmin } from "@/server/platform";
import { auditEntryData, newAuditRef } from "@/server/platform/audit";
import {
  isBookingEnabled,
  isValidTenantId,
  normalizeTenantStatus,
  planBookingChange,
  planStatusChange,
  validateReason,
} from "@/server/platform/model";

export type PlatformActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Error con mensaje apto para mostrarle al admin (el resto se loguea y sale genérico). */
class PlatformActionError extends Error {}

type Actor = { uid: string; email: string };

/**
 * Primera línea de TODA acción de esta sección: una Server Action es un
 * endpoint público (se puede invocar sin pasar por la pantalla), así que
 * el permiso se chequea acá adentro, no solo en el layout/página.
 */
async function platformActor(): Promise<Actor | null> {
  try {
    const user = await requirePlatformAdmin();
    return { uid: user.uid, email: user.email ?? "" };
  } catch {
    return null;
  }
}

function revalidateTenantViews(tenantId: string, slug: string) {
  revalidatePath("/platform");
  revalidatePath(`/platform/${tenantId}`);
  revalidatePath("/platform/auditoria");
  if (slug) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/app/${slug}`, "layout");
  }
}

function failure(error: unknown, fallback: string): PlatformActionResult {
  if (error instanceof PlatformActionError) return { ok: false, error: error.message };
  console.error("[platform]", error);
  return { ok: false, error: fallback };
}

/**
 * Apagar ("suspended") o prender ("active") un local. El estado actual se
 * relee DENTRO de la transacción -- nunca se confía en lo que muestra la
 * pantalla -- y el registro de `platformAudit` se escribe en la misma
 * transacción: o quedan los dos, o ninguno. Apagar exige motivo.
 */
export async function setTenantStatusAction(
  tenantId: string,
  nextStatus: "active" | "suspended",
  reason?: string | null,
): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };
  if (nextStatus !== "active" && nextStatus !== "suspended") return { ok: false, error: "Estado inválido" };
  const reasonCheck = validateReason(reason, nextStatus === "suspended");
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(tenantRef);
      if (!snapshot.exists) throw new PlatformActionError("El local no existe");
      const data = snapshot.data() ?? {};
      const change = planStatusChange(normalizeTenantStatus(data.status), nextStatus);
      if (!change.ok) throw new PlatformActionError(change.error);
      const name = String(data.name ?? "");

      transaction.update(tenantRef, change.value.to === "suspended"
        ? {
            status: "suspended",
            suspendedAt: FieldValue.serverTimestamp(),
            suspendedReason: reasonCheck.value,
            suspendedBy: actor.email,
            updatedAt: FieldValue.serverTimestamp(),
          }
        : {
            status: "active",
            suspendedAt: FieldValue.delete(),
            suspendedReason: FieldValue.delete(),
            suspendedBy: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
      transaction.create(newAuditRef(), auditEntryData({
        actorEmail: actor.email,
        actorUid: actor.uid,
        tenantId,
        tenantName: name,
        action: change.value.action,
        from: change.value.from,
        to: change.value.to,
        reason: reasonCheck.value,
      }));
      return { name, slug: String(data.slug ?? ""), to: change.value.to };
    });
    revalidateTenantViews(tenantId, result.slug);
    return {
      ok: true,
      message: result.to === "suspended" ? `${result.name} quedó apagado` : `${result.name} quedó activo`,
    };
  } catch (error) {
    return failure(error, "No se pudo cambiar el estado del local");
  }
}

/**
 * Prender/apagar SOLO el turnero público (settings.publicBookingEnabled),
 * sin tocar el panel de la dueña. Mismo esquema: relectura + auditoría en
 * la transacción, motivo obligatorio para apagarlo. Escribe el field path
 * con punto para no pisar el resto de `settings`.
 */
export async function setTenantBookingAction(
  tenantId: string,
  enabled: boolean,
  reason?: string | null,
): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };
  if (typeof enabled !== "boolean") return { ok: false, error: "Valor inválido" };
  const reasonCheck = validateReason(reason, !enabled);
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(tenantRef);
      if (!snapshot.exists) throw new PlatformActionError("El local no existe");
      const data = snapshot.data() ?? {};
      const change = planBookingChange(isBookingEnabled(data.settings as { publicBookingEnabled?: unknown } | undefined), enabled);
      if (!change.ok) throw new PlatformActionError(change.error);
      const name = String(data.name ?? "");

      transaction.update(tenantRef, {
        "settings.publicBookingEnabled": enabled,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(newAuditRef(), auditEntryData({
        actorEmail: actor.email,
        actorUid: actor.uid,
        tenantId,
        tenantName: name,
        action: change.value.action,
        from: change.value.from,
        to: change.value.to,
        reason: reasonCheck.value,
      }));
      return { name, slug: String(data.slug ?? "") };
    });
    revalidateTenantViews(tenantId, result.slug);
    return { ok: true, message: enabled ? `Turnero de ${result.name} prendido` : `Turnero de ${result.name} apagado` };
  } catch (error) {
    return failure(error, "No se pudo cambiar el turnero");
  }
}
