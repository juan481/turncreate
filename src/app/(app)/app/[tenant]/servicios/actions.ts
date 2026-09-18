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

export async function updateService(
  tenantSlug: string,
  serviceId: string,
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

  const { error: serviceError } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      price: parsed.data.price,
      buffer_after_min: parsed.data.bufferAfterMin,
    })
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id);

  if (serviceError) {
    return { error: serviceError.message };
  }

  // Simplificación intencional: se pisan todas las fases en vez de
  // diffear -- un servicio no tiene tantas fases como para que importe,
  // y así se evita reconciliar altas/bajas/reordenamientos.
  const { error: deleteError } = await supabase.from("service_phases").delete().eq("service_id", serviceId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  const { error: phaseError } = await supabase.from("service_phases").insert(
    parsed.data.phases.map((phase, index) => ({
      service_id: serviceId,
      position: index + 1,
      kind: phase.kind,
      minutes: phase.minutes,
    })),
  );

  if (phaseError) {
    return { error: phaseError.message };
  }

  revalidatePath(`/app/${tenantSlug}/servicios`);
  return { error: null };
}

export async function setServiceActive(tenantSlug: string, serviceId: string, active: boolean) {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id);

  if (error) return { error: error.message };

  revalidatePath(`/app/${tenantSlug}/servicios`);
  return { error: null };
}

export async function archiveService(tenantSlug: string, serviceId: string) {
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase
    .from("services")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", serviceId)
    .eq("tenant_id", tenant.id);

  if (error) return { error: error.message };

  revalidatePath(`/app/${tenantSlug}/servicios`);
}
