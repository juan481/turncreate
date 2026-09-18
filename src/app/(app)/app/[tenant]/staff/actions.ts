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

  const serviceIds = formData.getAll("serviceIds").filter((v): v is string => typeof v === "string" && v.length > 0);

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: staff, error } = await supabase
    .from("staff")
    .insert({
      tenant_id: tenant.id,
      display_name: parsed.data.displayName,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (serviceIds.length > 0) {
    const { error: linkError } = await supabase
      .from("staff_services")
      .insert(serviceIds.map((serviceId) => ({ staff_id: staff.id, service_id: serviceId })));

    if (linkError) {
      return { error: `Profesional creado, pero no se pudieron asignar los servicios: ${linkError.message}` };
    }
  }

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}

export async function updateStaffServices(
  tenantSlug: string,
  staffId: string,
  _prevState: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const serviceIds = formData.getAll("serviceIds").filter((v): v is string => typeof v === "string" && v.length > 0);

  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("staff_services").delete().eq("staff_id", staffId);
  if (deleteError) return { error: deleteError.message };

  if (serviceIds.length > 0) {
    const { error: insertError } = await supabase
      .from("staff_services")
      .insert(serviceIds.map((serviceId) => ({ staff_id: staffId, service_id: serviceId })));
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}
