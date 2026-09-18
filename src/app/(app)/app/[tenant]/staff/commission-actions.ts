"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";

export type CommissionActionState = { error: string | null };

// Regla "genérica" del profesional: staff_id seteado, service_id y
// category_id nulos -- es la de menor prioridad (sección 5.5: servicio >
// categoría > profesional), se usa cuando nadie definió algo más
// específico para ese servicio o categoría.
export async function upsertStaffCommission(
  tenantSlug: string,
  staffId: string,
  _prevState: CommissionActionState,
  formData: FormData,
): Promise<CommissionActionState> {
  const type = formData.get("type");
  const value = Number(formData.get("value") ?? 0);

  if (type !== "percent" && type !== "fixed") {
    return { error: "Tipo de comisión inválido" };
  }
  if (value <= 0) {
    return { error: "El valor tiene que ser mayor a 0" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: existing, error: findError } = await supabase
    .from("commission_rules")
    .select("id")
    .eq("tenant_id", tenant.id)
    .eq("staff_id", staffId)
    .is("service_id", null)
    .is("category_id", null)
    .maybeSingle();

  if (findError) return { error: findError.message };

  const { error } = existing
    ? await supabase.from("commission_rules").update({ type, value }).eq("id", existing.id)
    : await supabase.from("commission_rules").insert({ tenant_id: tenant.id, staff_id: staffId, type, value });

  if (error) return { error: error.message };

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}
