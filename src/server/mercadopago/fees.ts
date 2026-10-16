import "server-only";
import { firebaseAdmin } from "@/server/firebase/admin";

export type ObservedMpFee = { percent: number; paidAt: string };

const DAY_MS = 24 * 60 * 60_000;
/** Ventanas hacia atrás, de la más reciente a la más vieja (en días). */
const WINDOWS_DAYS = [7, 30];

/**
 * Mercado Pago no expone por API la tarifa que tiene configurada el
 * vendedor (depende del plazo de acreditación que eligió en su cuenta):
 * solo informa la comisión cobrada en cada pago (`fee_details`), que el
 * webhook ya guarda en `payments`. Con eso se sugiere la tasa real del
 * último cobro.
 *
 * Se llama en cada carga de Pagos y señas, así que tiene que ser barata:
 * - Se recorre en ventanas que no se pisan (últimos 7 días, 7-30, 30-120)
 *   y se corta en la primera que tenga un cobro de MP: un local activo
 *   lee solo la semana, no los 4 meses.
 * - `.select()` baja solo los 5 campos que se miran, no el doc entero.
 * Usa el índice compuesto que ya existe (tenantId + paidAt ASC, el de
 * getPaymentSummary). Un `orderBy("paidAt", "desc").limit(n)` sería todavía
 * más barato pero necesita un índice DESC nuevo en firestore.indexes.json.
 */
export async function latestObservedMpFee(tenantId: string, lookbackDays = 120): Promise<ObservedMpFee | null> {
  const now = Date.now();
  const bounds = [...WINDOWS_DAYS.filter((days) => days < lookbackDays), lookbackDays];
  let until = new Date(now);
  for (const days of bounds) {
    const since = new Date(now - days * DAY_MS);
    const latest = await latestInWindow(tenantId, since, until);
    if (latest) return { percent: latest.percent, paidAt: latest.paidAt.toISOString() };
    until = since;
  }
  return null;
}

async function latestInWindow(tenantId: string, since: Date, until: Date) {
  const snapshot = await firebaseAdmin().db.collectionGroup("payments")
    .where("tenantId", "==", tenantId)
    .where("paidAt", ">=", since)
    .where("paidAt", "<", until)
    .select("method", "status", "grossAmount", "feeAmount", "paidAt")
    .get();
  let latest: { percent: number; paidAt: Date } | null = null;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.method !== "mercadopago" || data.status !== "approved") continue;
    const gross = Number(data.grossAmount ?? 0);
    const fee = Number(data.feeAmount ?? 0);
    const paidAt: Date | undefined = data.paidAt?.toDate?.();
    if (!paidAt || gross <= 0 || fee <= 0) continue;
    if (!latest || paidAt > latest.paidAt) latest = { percent: Math.round((fee / gross) * 10_000) / 100, paidAt };
  }
  return latest;
}
