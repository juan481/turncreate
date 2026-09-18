"use server";

import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { getMonthData, type MonthData } from "@/server/agenda-month";

export async function loadMonth(tenantSlug: string, monthISO: string): Promise<MonthData> {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);
  return getMonthData(supabase, { tenantId: tenant.id, timezone: tenant.timezone, monthISO });
}
