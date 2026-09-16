"use server";

import { createClient } from "@/server/supabase/server";

export async function createTenantAction(formData: {
  name: string;
  slug: string;
  businessTypeId: string;
  businessHours: { weekday: number; opens_at: string; closes_at: string }[];
}) {
  const supabase = await createClient();

  const { data: tenant, error } = await supabase.rpc("onboard_tenant", {
    p_name: formData.name,
    p_slug: formData.slug,
    p_business_type_id: formData.businessTypeId,
    p_business_hours: formData.businessHours,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Esa URL de turnero ya está en uso, probá con otra");
    }
    throw new Error(error.message);
  }

  return { slug: tenant.slug };
}
