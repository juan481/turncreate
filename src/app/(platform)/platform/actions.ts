"use server";
import { revalidatePath } from "next/cache";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
export async function toggleTenantStatusAction(tenantId: string, status: string) { const user = await getCurrentFirebaseUser(); if (!user || user.email !== process.env.PLATFORM_ADMIN_EMAIL) return { success: false, error: "Sin permiso" }; await firebaseAdmin().db.collection("tenants").doc(tenantId).update({ status: status === "active" ? "suspended" : "active" }); revalidatePath("/platform"); return { success: true }; }
