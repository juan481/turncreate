"use server";

import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getMonthData, type MonthData } from "@/server/agenda-month";

export async function loadMonth(tenantSlug: string, monthISO: string): Promise<MonthData> {
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) throw new Error("El local no existe");
  return getMonthData({ tenantId: tenant.id, timezone: tenant.timezone, monthISO });
}
