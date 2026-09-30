import { NextResponse } from "next/server";

// TODO Fase 3 (5.6): validar el token de verificación de Meta (GET) y
// procesar mensajes entrantes del cliente como alerta en el turno (POST).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("hub.challenge");
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  if (
    mode !== "subscribe" ||
    !challenge ||
    !process.env.WHATSAPP_VERIFY_TOKEN ||
    token !== process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return new NextResponse(challenge);
}

export async function POST() {
  // No aceptar eventos hasta implementar la validación HMAC de Meta.
  return NextResponse.json({ error: "Webhook not configured" }, { status: 501 });
}
