import { NextResponse } from "next/server";

// TODO Fase 3 (5.6): procesa outbox_events, guarda en message_logs,
// reintenta hasta 5 veces con espera creciente.
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
