import { after, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { mercadoPagoEnv } from "@/server/mercadopago/config";
import { validateMercadoPagoSignature } from "@/server/mercadopago/signature";
import { reconcileMercadoPagoPayment } from "@/server/mercadopago/checkout";

type MpNotification = { type?: string; action?: string; user_id?: number | string; data?: { id?: string | number } };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as MpNotification | null;
  const dataId = body?.data?.id != null ? String(body.data.id) : null;
  const secret = mercadoPagoEnv().webhookSecret;
  if (!secret || !validateMercadoPagoSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  })) {
    return NextResponse.json({ error: "Firma invÃ¡lida" }, { status: 401 });
  }
  if (body?.type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  const eventRef = firebaseAdmin().db.collection("mpWebhookEvents").doc(`payment_${dataId}`);
  const claimed = await firebaseAdmin().db.runTransaction(async (transaction) => {
    const current = await transaction.get(eventRef);
    const data = current.data();
    if (data?.processedAt || (data?.processingUntil?.toMillis?.() ?? 0) > Date.now()) return false;
    transaction.set(eventRef, {
      type: "payment", paymentId: dataId,
      sellerId: body.user_id != null ? String(body.user_id) : data?.sellerId ?? null,
      action: body.action ?? data?.action ?? null,
      attempts: data?.attempts ?? 0,
      receivedAt: data?.receivedAt ?? FieldValue.serverTimestamp(),
      processedAt: null,
      processingUntil: Timestamp.fromMillis(Date.now() + 5 * 60_000),
    }, { merge: true });
    return true;
  });
  if (claimed) {
    after(async () => {
      try {
        await eventRef.set({ attempts: FieldValue.increment(1), lastAttemptAt: FieldValue.serverTimestamp() }, { merge: true });
        await reconcileMercadoPagoPayment(dataId);
      } catch (error) {
        await eventRef.set({ lastError: error instanceof Error ? error.message.slice(0, 300) : "Error desconocido" }, { merge: true });
      }
    });
  }
  return NextResponse.json({ ok: true });
}
