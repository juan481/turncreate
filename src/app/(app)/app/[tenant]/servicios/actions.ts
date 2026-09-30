"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { createServiceSchema } from "@/lib/schemas/service";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";

export type ServiceActionState = { error: string | null };

function parseService(formData: FormData) {
  let phases: unknown = [];
  try {
    phases = JSON.parse(typeof formData.get("phases") === "string" ? String(formData.get("phases")) : "[]");
  } catch {
    return { error: "Las fases no se pudieron leer, probá de nuevo" } as const;
  }
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"), price: formData.get("price"),
    bufferAfterMin: formData.get("bufferAfterMin") || 0, phases,
  });
  return parsed.success ? { data: parsed.data } : { error: parsed.error.issues[0]?.message ?? "Datos inválidos" } as const;
}

async function authenticatedTenant(tenantSlug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return requireTenantAccess(user.uid, tenantSlug);
}

export async function createService(tenantSlug: string, _prevState: ServiceActionState, formData: FormData): Promise<ServiceActionState> {
  const input = parseService(formData);
  if (!("data" in input)) return { error: input.error };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const serviceRef = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc();
    await serviceRef.create({
      id: serviceRef.id, tenantId: tenant.id, name: input.data.name, price: input.data.price,
      bufferAfterMin: input.data.bufferAfterMin, phases: input.data.phases.map((phase, index) => ({ ...phase, position: index + 1 })),
      active: true, sort: Date.now(), archivedAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/app/${tenantSlug}/servicios`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el servicio" }; }
}

export async function updateService(tenantSlug: string, serviceId: string, _prevState: ServiceActionState, formData: FormData): Promise<ServiceActionState> {
  const input = parseService(formData);
  if (!("data" in input)) return { error: input.error };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc(serviceId);
    if (!(await ref.get()).exists) return { error: "El servicio no existe" };
    await ref.update({ name: input.data.name, price: input.data.price, bufferAfterMin: input.data.bufferAfterMin, phases: input.data.phases.map((phase, index) => ({ ...phase, position: index + 1 })), updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/servicios`); revalidatePath(`/app/${tenantSlug}/servicios/${serviceId}`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio" }; }
}

export async function setServiceActive(tenantSlug: string, serviceId: string, active: boolean) {
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc(serviceId).update({ active, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/servicios`); return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio" }; }
}

export async function archiveService(tenantSlug: string, serviceId: string) {
  const { tenant } = await authenticatedTenant(tenantSlug);
  await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc(serviceId).update({ active: false, archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  revalidatePath(`/app/${tenantSlug}/servicios`);
}
