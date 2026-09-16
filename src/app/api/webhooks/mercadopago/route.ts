import { NextResponse } from "next/server";

// TODO Fase 2 (5.4): verificar firma, consultar el pago por API,
// validar monto y external_reference, y dedupear por webhook_events.external_id.
export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
