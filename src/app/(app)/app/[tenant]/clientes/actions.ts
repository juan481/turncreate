"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { createClientSchema } from "@/lib/schemas/client";

export type ClientActionState = { error: string | null };

export async function addClient(
  tenantSlug: string,
  _prevState: ClientActionState,
  formData: FormData,
): Promise<ClientActionState> {
  const parsed = createClientSchema.safeParse({
    fullName: formData.get("fullName"),
    phoneE164: formData.get("phoneE164"),
    email: formData.get("email") || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createSupabaseClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase.from("clients").insert({
    tenant_id: tenant.id,
    full_name: parsed.data.fullName,
    phone_e164: parsed.data.phoneE164,
    email: parsed.data.email || null,
  });

  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe un cliente con ese teléfono" : error.message,
    };
  }

  revalidatePath(`/app/${tenantSlug}/clientes`);
  return { error: null };
}
