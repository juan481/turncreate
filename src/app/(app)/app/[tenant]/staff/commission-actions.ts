"use server";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
export type CommissionActionState = { error: string | null };
export async function upsertStaffCommission(tenantSlug: string, staffId: string, _prev: CommissionActionState, formData: FormData): Promise<CommissionActionState> { const type = formData.get("type"); const value = Number(formData.get("value") ?? 0); if ((type !== "percent" && type !== "fixed") || value <= 0) return { error: "Ingresá una comisión válida" }; try { const user = await getCurrentFirebaseUser(); if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." }; const { tenant } = await requireTenantAccess(user.uid, tenantSlug); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").doc(staffId).update({ commission: { type, value }, updatedAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar la comisión" }; } }
