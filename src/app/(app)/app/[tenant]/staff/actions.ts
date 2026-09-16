"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { createStaffSchema } from "@/lib/schemas/staff";

export type StaffActionState = { error: string | null };

export async function addStaff(
  tenantSlug: string,
  _prevState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const parsed = createStaffSchema.safeParse({ displayName: formData.get("displayName") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase.from("staff").insert({
    tenant_id: tenant.id,
    display_name: parsed.data.displayName,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}
