"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
const schema = z.array(z.object({ weekday: z.number().int().min(0).max(6), starts_at: z.string().regex(/^\d{2}:\d{2}$/), ends_at: z.string().regex(/^\d{2}:\d{2}$/) }));
export type ScheduleActionState = { error: string | null };
export async function updateStaffSchedule(tenantSlug: string, staffId: string, _prev: ScheduleActionState, formData: FormData): Promise<ScheduleActionState> { try { const parsed = schema.safeParse(JSON.parse(typeof formData.get("days") === "string" ? String(formData.get("days")) : "[]")); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }; const user = await getCurrentFirebaseUser(); if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." }; const { tenant } = await requireTenantAccess(user.uid, tenantSlug); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").doc(staffId).update({ schedules: parsed.data, updatedAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el horario" }; } }
