"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { createStaffSchema, updateStaffPhotoSchema } from "@/lib/schemas/staff";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { planFeatures } from "@/lib/plans";
export type StaffActionState = { error: string | null };
async function access(slug: string) { const user = await getCurrentFirebaseUser(); if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión."); return requireTenantAccess(user.uid, slug); }
export async function addStaff(tenantSlug: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = createStaffSchema.safeParse({ displayName: formData.get("displayName"), photoUrl: formData.get("photoUrl") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try { const { tenant } = await access(tenantSlug); const staffCollection = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff"); const active = await staffCollection.where("active", "==", true).get(); if (active.size >= planFeatures(tenant).maxStaff) return { error: "Tu plan ya alcanzó el máximo de profesionales" }; const ref = staffCollection.doc(); const serviceIds = formData.getAll("serviceIds").filter((value): value is string => typeof value === "string" && value.length > 0); await ref.create({ id: ref.id, tenantId: tenant.id, displayName: parsed.data.displayName, active: true, color: "#767582", photoUrl: parsed.data.photoUrl, serviceIds, schedules: [], commission: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el profesional" }; }
}
export async function updateStaffPhoto(tenantSlug: string, staffId: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const parsed = updateStaffPhotoSchema.safeParse({ photoUrl: formData.get("photoUrl") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try { const { tenant } = await access(tenantSlug); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").doc(staffId).update({ photoUrl: parsed.data.photoUrl, updatedAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar la foto" }; }
}
export async function updateStaffServices(tenantSlug: string, staffId: string, _prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  try { const { tenant } = await access(tenantSlug); const serviceIds = formData.getAll("serviceIds").filter((value): value is string => typeof value === "string" && value.length > 0); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").doc(staffId).update({ serviceIds, autoAssignServices: false, updatedAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudieron actualizar los servicios" }; }
}
