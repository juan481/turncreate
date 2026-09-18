"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";

export type ConfigActionState = { error: string | null; success?: boolean };

export async function updateBusinessInfo(
  tenantSlug: string,
  _prevState: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const name = formData.get("name");
  const address = formData.get("address");
  const instagramUrl = formData.get("instagramUrl");
  const whatsappNumber = formData.get("whatsappNumber");

  if (typeof name !== "string" || name.trim().length < 2) {
    return { error: "Ingresá un nombre válido para el local" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase
    .from("tenants")
    .update({
      name: name.trim(),
      address: typeof address === "string" && address ? address : null,
      instagram_url: typeof instagramUrl === "string" && instagramUrl ? instagramUrl : null,
      whatsapp_number: typeof whatsappNumber === "string" && whatsappNumber ? whatsappNumber : null,
    })
    .eq("id", tenant.id);

  if (error) return { error: error.message };

  revalidatePath(`/app/${tenantSlug}/configuracion`);
  return { error: null, success: true };
}

export async function updateBusinessHours(
  tenantSlug: string,
  _prevState: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const hoursRaw = formData.get("hours");
  let hours: unknown;
  try {
    hours = JSON.parse(typeof hoursRaw === "string" ? hoursRaw : "[]");
  } catch {
    return { error: "Los horarios no se pudieron leer, probá de nuevo" };
  }

  if (!Array.isArray(hours)) {
    return { error: "Datos inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error: deleteError } = await supabase.from("business_hours").delete().eq("tenant_id", tenant.id);
  if (deleteError) return { error: deleteError.message };

  if (hours.length > 0) {
    const { error: insertError } = await supabase.from("business_hours").insert(
      hours.map((h: { weekday: number; opens_at: string; closes_at: string }) => ({
        tenant_id: tenant.id,
        weekday: h.weekday,
        opens_at: h.opens_at,
        closes_at: h.closes_at,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/app/${tenantSlug}/configuracion`);
  return { error: null, success: true };
}

export async function updateDepositSettings(
  tenantSlug: string,
  _prevState: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  const depositType = formData.get("depositType");
  const depositValue = Number(formData.get("depositValue") ?? 0);
  const depositMin = Number(formData.get("depositMin") ?? 0);

  if (depositType !== "none" && depositType !== "percent" && depositType !== "fixed") {
    return { error: "Tipo de seña inválido" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase
    .from("tenant_settings")
    .update({ deposit_type: depositType, deposit_value: depositValue, deposit_min: depositMin })
    .eq("tenant_id", tenant.id);

  if (error) return { error: error.message };

  revalidatePath(`/app/${tenantSlug}/configuracion`);
  return { error: null, success: true };
}
