import { after, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { mercadoPagoEnv } from "@/server/mercadopago/config";
import { validateMercadoPagoSignature } from "@/server/mercadopago/signature";
import { reconcileMercadoPagoPayment } from "@/server/mercadopago/checkout";
import { subscriptionTopic } from "@/server/billing/model";
import { handleSubscriptionNotification } from "@/server/billing/webhook";

type MpNotification = { type?: string; action?: string; user_id?: number | string; data?: { id?: string | number } };

/**
 * Firma HMAC de MP. Además del secreto de la app de TurnCreate (MP_WEBHOOK_SECRET)
 * se acepta MP_PLATFORM_WEBHOOK_SECRET por si la suscripción de los locales
 * se cobra con OTRA aplicación de MP de Just Create (cada app tiene su clave).
 */
function validSignature(request: Request, dataId: string | null) {
  const secrets = [mercadoPagoEnv().webhookSecret, process.env.MP_PLATFORM_WEBHOOK_SECRET?.trim()]
    .filter((secret): secret is string => Boolean(secret));
  return secrets.some((secret) => validateMercadoPagoSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  }));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as MpNotification | null;
  const url = new URL(request.url);
  // MP firma con el data.id del query string; el body trae el mismo id.
  const dataId = body?.data?.id != null ? String(body.data.id) : url.searchParams.get("data.id");
  if (!validSignature(request, dataId)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
  }

  // Suscripción del local a TurnCreate (cuenta de Just Create): preapproval y
  // cuotas. Se procesa en el momento (es corto e idempotente vía billingEvents):
  // si MP no responde, 500 y MP reintenta.
  const topic = subscriptionTopic(body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic"));
  if (topic) {
    if (!dataId) return NextResponse.json({ ok: true });
    try {
      const result = await handleSubscriptionNotification({ topic, id: dataId });
      return NextResponse.json({ ok: true, result });
    } catch (error) {
      console.error("[webhook mp] suscripción", topic, dataId, error instanceof Error ? error.message : error);
      return NextResponse.json({ error: "No se pudo procesar" }, { status: 500 });
    }
  }

  if (body?.type !== "payment" || !dataId) return NextResponse.json({ ok: true });

  const eventRef = firebaseAdmin().db.collection("mpWebhookEvents").doc(`payment_${dataId}`);
  const requestId = request.headers.get("x-request-id")!;
  const claimed = await firebaseAdmin().db.runTransaction(async (transaction) => {
    const current = await transaction.get(eventRef);
    const data = current.data();
    // Mercado Pago puede notificar el mismo payment varias veces a medida que
    // cambia de pending a approved. Solo deduplicamos la entrega exacta; una
    // notificacion posterior con otro request-id debe volver a reconciliar.
    if (data?.lastRequestId === requestId) return "duplicate" as const;
    // Otra notificación del mismo pago se está procesando: 409 para que MP
    // reintente después. Con 200 este aviso (quizás el del approved) se perdía.
    if ((data?.processingUntil?.toMillis?.() ?? 0) > Date.now()) return "busy" as const;
    transaction.set(eventRef, {
      type: "payment", paymentId: dataId,
      sellerId: body.user_id != null ? String(body.user_id) : data?.sellerId ?? null,
      action: body.action ?? data?.action ?? null,
      lastRequestId: requestId,
      attempts: data?.attempts ?? 0,
      receivedAt: data?.receivedAt ?? FieldValue.serverTimestamp(),
      lastReceivedAt: FieldValue.serverTimestamp(),
      processedAt: null,
      processingUntil: Timestamp.fromMillis(Date.now() + 5 * 60_000),
    }, { merge: true });
    return "claimed" as const;
  });
  if (claimed === "busy") return NextResponse.json({ error: "En proceso" }, { status: 409 });
  if (claimed === "claimed") {
    after(async () => {
      try {
        await eventRef.set({ attempts: FieldValue.increment(1), lastAttemptAt: FieldValue.serverTimestamp() }, { merge: true });
        await reconcileMercadoPagoPayment(dataId);
      } catch (error) {
        await eventRef.set({
          processingUntil: Timestamp.fromMillis(0),
          lastError: error instanceof Error ? error.message.slice(0, 300) : "Error desconocido",
        }, { merge: true });
      }
    });
  }
  return NextResponse.json({ ok: true });
}
