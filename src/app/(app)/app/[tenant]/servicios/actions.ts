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
  const phasesRaw = formData.get("phases");
  let phases: unknown = [];
  try {
    phases = JSON.parse(typeof phasesRaw === "string" ? phasesRaw : "[]");
  } catch {
    return { error: "Las fases no se pudieron leer, probá de nuevo" };
  }

  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    bufferAfterMin: formData.get("bufferAfterMin") || 0,
    phases,
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

  const { error: phaseError } = await supabase.from("service_phases").insert(
    parsed.data.phases.map((phase, index) => ({
      service_id: service.id,
      position: index + 1,
      kind: phase.kind,
      minutes: phase.minutes,
    })),
  );

  if (phaseError) {
    // Sin esto, un fallo acá deja un servicio sin fases (duración 0,
    // invisible para el motor de disponibilidad pero visible en la lista).
    await supabase.from("services").delete().eq("id", service.id);
    return { error: phaseError.message };
  }

  revalidatePath(`/app/${tenantSlug}/servicios`);
  return { error: null };
}
