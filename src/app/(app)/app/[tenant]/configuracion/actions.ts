"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { disconnectMp } from "@/server/mercadopago/connections";

export type ConfigActionState = { error: string | null; success?: boolean };

async function tenantForUser(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesiÃ³n venciÃ³. VolvÃ© a iniciar sesiÃ³n.");
  return requireTenantAccess(user.uid, slug);
}

export async function updateBusinessInfo(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 2) return { error: "IngresÃ¡ un nombre vÃ¡lido para el local" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({
      name: name.trim(), address: String(formData.get("address") || "") || null,
      instagramUrl: String(formData.get("instagramUrl") || "") || null,
      whatsappNumber: String(formData.get("whatsappNumber") || "") || null,
      logoUrl: String(formData.get("logoUrl") || "") || null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el negocio" }; }
}

export async function updateBusinessHours(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  try {
    const hours = JSON.parse(typeof formData.get("hours") === "string" ? String(formData.get("hours")) : "[]");
    if (!Array.isArray(hours) || !hours.every((hour) => typeof hour.weekday === "number" && /^\d{2}:\d{2}$/.test(hour.opens_at) && /^\d{2}:\d{2}$/.test(hour.closes_at))) return { error: "Horarios invÃ¡lidos" };
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({ businessHours: hours.map((hour) => ({ weekday: hour.weekday, opensAt: hour.opens_at, closesAt: hour.closes_at })), updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudieron actualizar los horarios" }; }
}

export async function updateDepositSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const depositType = formData.get("depositType");
  const depositValue = Number(formData.get("depositValue") ?? 0);
  const depositMin = Number(formData.get("depositMin") ?? 0);
  if (depositType !== "none" && depositType !== "percent" && depositType !== "fixed") return { error: "Tipo de seÃ±a invÃ¡lido" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({ settings: { ...tenant.settings, depositType, depositValue, depositMin }, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar la seÃ±a" }; }
}

export async function updateMercadoPagoSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  void _prev;
  const feeMode = formData.get("feeMode");
  const feePercent = Number(formData.get("feePercent") ?? 0);
  if (feeMode !== "absorbed" && feeMode !== "passed_through") return { error: "ElegÃ­ quiÃ©n absorbe el costo" };
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 50) return { error: "IngresÃ¡ un porcentaje vÃ¡lido" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({ settings: { ...tenant.settings, mpFeeMode: feeMode, mpFeePercent: feePercent }, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar Mercado Pago" }; }
}

export async function disconnectMercadoPago(tenantSlug: string, _prev: ConfigActionState): Promise<ConfigActionState> {
  void _prev;
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await disconnectMp(tenant.id);
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo desconectar Mercado Pago" }; }
}
