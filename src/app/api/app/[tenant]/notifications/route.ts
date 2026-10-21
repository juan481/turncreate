import { NextResponse } from "next/server";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { listAppNotifications } from "@/server/firebase/app-notifications";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/app/[tenant]/notifications">) {
  const user = await getCurrentFirebaseUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { tenant: tenantSlug } = await context.params;
    const { tenant } = await requireTenantAccess(user.uid, tenantSlug, { write: false });
    const notifications = await listAppNotifications(tenant.id, tenant.slug);
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer las notificaciones";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
