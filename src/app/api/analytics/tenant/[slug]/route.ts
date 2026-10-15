import { NextRequest, NextResponse } from "next/server";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { getTenantAnalyticsRange } from "@/server/analytics";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentFirebaseUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { slug } = await context.params;
    const { tenant } = await requireTenantAccess(user.uid, slug);
    const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 14);
    const analytics = await getTenantAnalyticsRange({ tenantId: tenant.id, timezone: tenant.timezone, days: requestedDays });
    return NextResponse.json(analytics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer la analítica";
    const status = message.includes("acceso") || message.includes("existe") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
