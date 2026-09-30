import { NextResponse } from "next/server";

// TODO Fase 2 (5.2): pg_cron ya borra los holds vencidos en la base;
// este endpoint queda como fallback/observabilidad si Vercel Cron lo llama.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
