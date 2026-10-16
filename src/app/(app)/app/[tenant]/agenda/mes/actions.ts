"use server";

import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { getMonthData, type MonthData } from "@/server/agenda-month";

export async function loadMonth(tenantSlug: string, monthISO: string): Promise<MonthData> {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("No autorizado");
  const { tenant } = await requireTenantAccess(user.uid, tenantSlug);
  return getMonthData({ tenantId: tenant.id, timezone: tenant.timezone, monthISO });
}
