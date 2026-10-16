"use server";

import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import {
  PlatformActionError,
  failure,
  platformActor,
  revalidateTenantViews,
  type PlatformActionResult,
} from "@/server/platform/action-support";
import { auditEntryData, newAuditRef } from "@/server/platform/audit";
import {
  isBookingEnabled,
  isValidTenantId,
  normalizeTenantStatus,
  planBookingChange,
  planStatusChange,
  validateReason,
} from "@/server/platform/model";
import { checkTenantDeletion } from "@/server/platform/billing-model";
import { readTenantBilling } from "@/server/billing/tenant-billing";

// Los tipos se pueden re-exportar desde un archivo "use server" (no son endpoints).
export type { PlatformActionResult } from "@/server/platform/action-support";

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

/**
 * Marcar/desmarcar un local como demo (los de muestra: demo-individual,
 * demo-equipo, demo-barberia...). Un demo no cuenta en los KPIs de la
 * consola; no cambia nada de lo que ve la dueña ni del turnero.
 */
export async function setTenantDemoAction(tenantId: string, isDemo: boolean): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };
  if (typeof isDemo !== "boolean") return { ok: false, error: "Valor inválido" };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  try {
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(tenantRef);
      if (!snapshot.exists) throw new PlatformActionError("El local no existe");
      const data = snapshot.data() ?? {};
      const current = data.isDemo === true;
      if (current === isDemo) throw new PlatformActionError(isDemo ? "Ya estaba marcado como demo" : "Ya no era demo");
      const name = String(data.name ?? "");
      transaction.update(tenantRef, { isDemo, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(newAuditRef(), auditEntryData({
        actorEmail: actor.email,
        actorUid: actor.uid,
        tenantId,
        tenantName: name,
        action: isDemo ? "tenant.demo_on" : "tenant.demo_off",
        from: current ? "on" : "off",
        to: isDemo ? "on" : "off",
        reason: null,
      }));
      return { name, slug: String(data.slug ?? "") };
    });
    revalidateTenantViews(tenantId, result.slug);
    return { ok: true, message: isDemo ? `${result.name} quedó marcado como demo` : `${result.name} ya no es demo` };
  } catch (error) {
    return failure(error, "No se pudo cambiar la marca de demo");
  }
}

const DELETE_PAGE = 400;

/** Borra en tandas los docs de una colección raíz con `tenantId == id` (índice automático de un campo). */
async function deleteRootDocsOfTenant(collection: string, tenantId: string): Promise<void> {
  const { db } = firebaseAdmin();
  for (;;) {
    const page = await db.collection(collection).where("tenantId", "==", tenantId).select().limit(DELETE_PAGE).get();
    if (page.empty) return;
    const batch = db.batch();
    page.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    if (page.size < DELETE_PAGE) return;
  }
}

/**
 * Eliminar un local entero. Doble seguro: tiene que estar YA apagado o
 * dado de baja, y hay que escribir su URL exacta + motivo. La auditoría se
 * escribe ANTES de borrar (con el nombre como foto: después no queda de
 * dónde sacarlo), en la misma transacción que relee y valida el estado.
 *
 * Borra: tenants/{id} con TODAS sus subcolecciones (recursiveDelete),
 * tenantSlugs/{slug}, lo de las colecciones raíz con ese tenantId
 * (tenantClientPhones, pendingTransfers, pendingTransferPhones,
 * bookingAttempts, mpSellers) y users/{uid}/memberships/{id} de cada
 * miembro. NUNCA borra usuarios de Firebase Auth ni users/{uid} (la misma
 * persona puede tener otro local), ni billingPayments (la contabilidad de
 * Just Create) ni platformAudit.
 *
 * Orden: primero la URL (el turnero deja de resolver al toque), después lo
 * suelto y al final el local: si algo falla a mitad de camino, el local
 * sigue existiendo (apagado) y se puede volver a intentar.
 */
export async function deleteTenantAction(
  tenantId: string,
  typedSlug: string,
  reason: string,
): Promise<PlatformActionResult> {
  const actor = await platformActor();
  if (!actor) return { ok: false, error: "Sin permiso" };
  if (!isValidTenantId(tenantId)) return { ok: false, error: "Local inválido" };
  if (typeof reason !== "string" || !reason.trim()) return { ok: false, error: "Contá por qué lo eliminás: queda en la auditoría" };
  const reasonCheck = validateReason(reason, true);
  if (!reasonCheck.ok) return { ok: false, error: reasonCheck.error };

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  let info: { name: string; slug: string };
  try {
    info = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(tenantRef);
      if (!snapshot.exists) throw new PlatformActionError("El local no existe (¿ya lo eliminaste?)");
      const data = snapshot.data() ?? {};
      const billing = (await readTenantBilling(data)) ?? null;
      const slug = String(data.slug ?? "");
      const check = checkTenantDeletion({
        tenantStatus: normalizeTenantStatus(data.status),
        billingStatus: billing?.status ?? null,
        slug,
        tenantId,
        typed: typedSlug,
      });
      if (!check.ok) throw new PlatformActionError(check.error);
      const name = String(data.name ?? "");
      transaction.create(newAuditRef(), auditEntryData({
        actorEmail: actor.email,
        actorUid: actor.uid,
        tenantId,
        tenantName: name,
        action: "tenant.delete",
        from: normalizeTenantStatus(data.status),
        to: "deleted",
        reason: reasonCheck.value,
        detail: slug ? `URL /${slug}` : null,
      }));
      return { name, slug };
    });
  } catch (error) {
    return failure(error, "No se pudo eliminar el local");
  }

  try {
    const [members, mpIntegration] = await Promise.all([
      tenantRef.collection("members").get(),
      tenantRef.collection("integrations").doc("mercadopago").get(),
    ]);

    if (info.slug) {
      const slugRef = db.collection("tenantSlugs").doc(info.slug);
      const slugDoc = await slugRef.get();
      if (slugDoc.exists && slugDoc.data()?.tenantId === tenantId) await slugRef.delete();
    }

    for (const collection of ["tenantClientPhones", "pendingTransfers", "pendingTransferPhones", "bookingAttempts", "mpSellers"]) {
      await deleteRootDocsOfTenant(collection, tenantId);
    }
    // El vendedor de MP de la integración, si apunta a este local (por si quedó sin el campo indexado).
    const sellerId = mpIntegration.data()?.sellerId;
    if (sellerId) {
      const sellerRef = db.collection("mpSellers").doc(String(sellerId));
      const seller = await sellerRef.get();
      if (seller.exists && seller.data()?.tenantId === tenantId) await sellerRef.delete();
    }

    const uids = new Set<string>();
    members.docs.forEach((doc) => {
      const uid = doc.data().uid;
      uids.add(typeof uid === "string" && uid ? uid : doc.id);
    });
    const membershipRefs = [...uids].map((uid) => db.collection("users").doc(uid).collection("memberships").doc(tenantId));
    for (let offset = 0; offset < membershipRefs.length; offset += DELETE_PAGE) {
      const batch = db.batch();
      membershipRefs.slice(offset, offset + DELETE_PAGE).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    await db.recursiveDelete(tenantRef);
  } catch (error) {
    console.error("[platform] deleteTenant", tenantId, error);
    revalidateTenantViews(tenantId, info.slug);
    return { ok: false, error: "Se borró una parte pero no todo: el local sigue en la lista, probá eliminarlo de nuevo" };
  }

  revalidateTenantViews(tenantId, info.slug);
  return { ok: true, message: `${info.name || "El local"} quedó eliminado` };
}
