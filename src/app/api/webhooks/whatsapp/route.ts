import { NextResponse } from "next/server";

// TODO Fase 3 (5.6): validar el token de verificación de Meta (GET) y
// procesar mensajes entrantes del cliente como alerta en el turno (POST).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get("hub.challenge");
  return new NextResponse(challenge ?? "ok");
}

export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
