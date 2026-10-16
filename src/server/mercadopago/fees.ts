import "server-only";
import { firebaseAdmin } from "@/server/firebase/admin";

export type ObservedMpFee = { percent: number; paidAt: string };

/**
 * Mercado Pago no expone por API la tarifa que tiene configurada el
 * vendedor (depende del plazo de acreditación que eligió en su cuenta):
 * solo informa la comisión cobrada en cada pago (`fee_details`), que el
 * webhook ya guarda en `payments`. Con eso se sugiere la tasa real del
 * último cobro. Misma forma de query que getPaymentSummary (índice
 * tenantId + paidAt ya existente).
 */
export async function latestObservedMpFee(tenantId: string, lookbackDays = 120): Promise<ObservedMpFee | null> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60_000);
  const snapshot = await firebaseAdmin().db.collectionGroup("payments")
    .where("tenantId", "==", tenantId)
    .where("paidAt", ">=", since)
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
  return latest ? { percent: latest.percent, paidAt: latest.paidAt.toISOString() } : null;
}
