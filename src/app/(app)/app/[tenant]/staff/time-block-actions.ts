"use server";
import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createTimeBlockSchema } from "@/lib/schemas/time-block";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
export type TimeBlockActionState = { error: string | null };
export async function createTimeBlock(tenantSlug: string, _prev: TimeBlockActionState, formData: FormData): Promise<TimeBlockActionState> { const parsed = createTimeBlockSchema.safeParse({ staffId: formData.get("staffId") || undefined, startsAt: formData.get("startsAt"), endsAt: formData.get("endsAt"), kind: formData.get("kind"), reason: formData.get("reason") || undefined }); if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" }; try { const user = await getCurrentFirebaseUser(); if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." }; const { tenant } = await requireTenantAccess(user.uid, tenantSlug); const startsAt = new TZDate(parsed.data.startsAt, tenant.timezone); const endsAt = new TZDate(parsed.data.endsAt, tenant.timezone); const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("timeBlocks").doc(); await ref.create({ id: ref.id, tenantId: tenant.id, staffId: parsed.data.staffId || null, startsAt: Timestamp.fromDate(startsAt), endsAt: Timestamp.fromDate(endsAt), kind: parsed.data.kind, reason: parsed.data.reason || null, createdAt: FieldValue.serverTimestamp() }); revalidatePath(`/app/${tenantSlug}/staff`); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el bloqueo" }; } }
