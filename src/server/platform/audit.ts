import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { auditDocId, isAuditAction, toDateOrNull, type AuditAction } from "./model";

/**
 * Auditoría de la consola de plataforma: colección raíz `platformAudit`,
 * un documento por cambio (apagar/prender local o turnero). Se escribe en
 * la MISMA transacción que el cambio (ver actions.ts de (platform)): si
 * el cambio se guarda, el registro también, y viceversa.
 *
 * Lecturas sin índices compuestos (producción los exige):
 *  - global: orderBy("at", "desc") -- índice automático de un campo.
 *  - de un local: where("tenantId", "==", id) + el orden natural por id,
 *    que gracias a auditDocId() ya es de más nuevo a más viejo.
 */
export const PLATFORM_AUDIT_COLLECTION = "platformAudit";

export type AuditEntry = {
  id: string;
  atISO: string | null;
  actorEmail: string;
  tenantId: string;
  tenantName: string;
  action: AuditAction;
  from: string;
  to: string;
  reason: string | null;
};

export function newAuditRef(now: Date = new Date()) {
  return firebaseAdmin().db.collection(PLATFORM_AUDIT_COLLECTION).doc(auditDocId(now, randomUUID()));
}

export function auditEntryData(input: {
  actorEmail: string;
  actorUid: string;
  tenantId: string;
  tenantName: string;
  action: AuditAction;
  from: string;
  to: string;
  reason: string | null;
}) {
  return { ...input, at: FieldValue.serverTimestamp() };
}

function toEntry(id: string, data: Record<string, unknown>): AuditEntry | null {
  if (!isAuditAction(data.action)) return null;
  return {
    id,
    atISO: toDateOrNull(data.at)?.toISOString() ?? null,
    actorEmail: String(data.actorEmail ?? ""),
    tenantId: String(data.tenantId ?? ""),
    tenantName: String(data.tenantName ?? ""),
    action: data.action,
    from: String(data.from ?? ""),
    to: String(data.to ?? ""),
    reason: typeof data.reason === "string" && data.reason ? data.reason : null,
  };
}

function byNewest(a: AuditEntry, b: AuditEntry) {
  return (b.atISO ?? "").localeCompare(a.atISO ?? "");
}

/** Últimos `limit` cambios de toda la plataforma. */
export async function getRecentAudit(limit = 100): Promise<AuditEntry[]> {
  const snapshot = await firebaseAdmin().db.collection(PLATFORM_AUDIT_COLLECTION)
    .orderBy("at", "desc")
    .limit(Math.max(1, Math.min(200, limit)))
    .get();
  return snapshot.docs
    .map((doc) => toEntry(doc.id, doc.data()))
    .filter((entry): entry is AuditEntry => entry !== null);
}

/** Últimos `limit` cambios de un local (orden por id = más nuevo primero; se reordena por `at` por las dudas). */
export async function getTenantAudit(tenantId: string, limit = 50): Promise<AuditEntry[]> {
  const snapshot = await firebaseAdmin().db.collection(PLATFORM_AUDIT_COLLECTION)
    .where("tenantId", "==", tenantId)
    .limit(Math.max(1, Math.min(200, limit)))
    .get();
  return snapshot.docs
    .map((doc) => toEntry(doc.id, doc.data()))
    .filter((entry): entry is AuditEntry => entry !== null)
    .sort(byNewest);
}
