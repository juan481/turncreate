"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { createServiceSchema } from "@/lib/schemas/service";

export type ServiceActionState = { error: string | null };

export async function createService(
  tenantSlug: string,
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    durationMin: formData.get("durationMin"),
    bufferAfterMin: formData.get("bufferAfterMin") || 0,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .insert({
      tenant_id: tenant.id,
      name: parsed.data.name,
      price: parsed.data.price,
      buffer_after_min: parsed.data.bufferAfterMin,
    })
    .select("id")
    .single();

  if (serviceError) {
    return { error: serviceError.message };
  }

  const { error: phaseError } = await supabase.from("service_phases").insert({
    service_id: service.id,
    position: 1,
    kind: "active",
    minutes: parsed.data.durationMin,
  });

  if (phaseError) {
    return { error: phaseError.message };
  }

  revalidatePath(`/app/${tenantSlug}/servicios`);
  return { error: null };
}
