"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
export type ChangeStatusState = { error: string | null };
export async function changeStatus(slug: string, appointmentId: string, dateISO: string, _prev: ChangeStatusState, formData: FormData): Promise<ChangeStatusState> { const status = formData.get("toStatus"); if (typeof status !== "string") return { error: "Falta el estado destino" }; const user = await getCurrentFirebaseUser(); if (!user) return { error: "No autorizado" }; const { tenant } = await requireTenantAccess(user.uid, slug); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId).update({ status, cancelReason: String(formData.get("reason") || "") || null, updatedAt: new Date() }); revalidatePath(`/app/${slug}/agenda`); redirect(`/app/${slug}/agenda?date=${dateISO}`); }
