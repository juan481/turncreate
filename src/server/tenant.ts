import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function getTenantBySlug(supabase: SupabaseClient<Database>, slug: string) {
  const { data, error } = await supabase
    .from("tenants")
    .select("id, name, slug, timezone, tenant_settings(slot_interval_min, min_notice_min, books_by_staff)")
    .eq("slug", slug)
    .single();

  if (error) throw error;
  return data;
}
