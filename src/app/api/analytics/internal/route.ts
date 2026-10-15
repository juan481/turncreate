import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { isDateISO } from "@/lib/dates";
import { isTrustedAnalyticsEvent, recordTrustedAnalyticsEvent } from "@/server/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const configured = process.env.ANALYTICS_INTERNAL_SECRET ?? process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!configured || !provided) return false;
  const expectedBuffer = Buffer.from(configured);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { tenantId?: unknown; event?: unknown; dateISO?: unknown } | null;
  if (!body || typeof body.tenantId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(body.tenantId) || !isTrustedAnalyticsEvent(body.event)) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }
  if (body.dateISO !== undefined && !isDateISO(body.dateISO)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const tenant = await firebaseAdmin().db.collection("tenants").doc(body.tenantId).get();
  if (!tenant.exists) return NextResponse.json({ error: "Tenant inexistente" }, { status: 404 });
  await recordTrustedAnalyticsEvent({
    tenantId: tenant.id,
    timezone: String(tenant.data()?.timezone ?? "America/Argentina/Buenos_Aires"),
    event: body.event,
    dateISO: body.dateISO,
  });
  return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
