import { NextResponse } from "next/server";

// TODO Fase 3 (5.6): recordatorio 24h antes (configurable), corre cada 5 min.
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
