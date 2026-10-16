"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { isStorableImageDataUrl, requireTenantAccess, saveBusinessHours } from "@/server/firebase/tenants";
import { flatHoursError, type FlatHours } from "@/components/ui/hours-editor-model";
import { disconnectMp } from "@/server/mercadopago/connections";
import { normalizeArPhone } from "@/lib/phone";
import { DESCRIPTION_MAX_LENGTH, normalizeDescription, normalizeInstagramUrl } from "@/server/tenant-profile";

export type ConfigActionState = { error: string | null; success?: boolean };

// 00:00 a 23:59: el regex del editor solo miraba el formato y aceptaba "25:00".
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function tenantForUser(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return requireTenantAccess(user.uid, slug);
}

export async function updateBusinessInfo(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 2) return { error: "Ingresá un nombre válido para el local" };
  const description = normalizeDescription(String(formData.get("description") ?? ""));
  if (description && description.length > DESCRIPTION_MAX_LENGTH) return { error: "La descripción es demasiado larga" };
  const instagramUrl = normalizeInstagramUrl(String(formData.get("instagramUrl") ?? ""));
  if (instagramUrl === undefined) return { error: "Revisá el usuario de Instagram" };
  const whatsappRaw = String(formData.get("whatsappNumber") ?? "").trim();
  const whatsappNumber = whatsappRaw ? normalizeArPhone(whatsappRaw) : null;
  if (whatsappRaw && !whatsappNumber) return { error: "Revisá el número de WhatsApp" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({
      name: name.trim(), description, address: String(formData.get("address") || "").trim() || null,
      instagramUrl,
      whatsappNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el negocio" }; }
}

// El logo viaja ya comprimido desde el navegador (~512px). El techo de
// 400 KB deja margen de sobra al límite de 1 MB por documento de Firestore,
// y el tipo se restringe a raster: nada de SVG ni esquemas raros en el src.
export async function updateTenantLogo(tenantSlug: string, dataUrl: string | null): Promise<ConfigActionState> {
  if (dataUrl !== null && !isStorableImageDataUrl(dataUrl)) {
    return { error: "La imagen no es válida. Probá con un PNG, JPG o WebP de hasta 2 MB." };
  }
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({ logoUrl: dataUrl, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}`, "layout");
    revalidatePath(`/${tenantSlug}`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar el logo" }; }
}

export async function updateBusinessHours(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  try {
    const hours: unknown = JSON.parse(typeof formData.get("hours") === "string" ? String(formData.get("hours")) : "[]");
    if (!Array.isArray(hours) || !hours.every((hour) => typeof hour?.weekday === "number" && HH_MM.test(hour.opens_at) && HH_MM.test(hour.closes_at))) return { error: "Horarios inválidos" };
    const flat: FlatHours[] = hours.map((hour) => ({ weekday: hour.weekday, opens_at: hour.opens_at, closes_at: hour.closes_at }));
    // Misma validación que el editor: un request armado a mano no puede
    // guardar 25:00, franjas al revés o superpuestas.
    const invalid = flatHoursError(flat);
    if (invalid) return { error: invalid };
    const { tenant } = await tenantForUser(tenantSlug);
    const nextHours = flat.map((hour) => ({ weekday: hour.weekday, opensAt: hour.opens_at, closesAt: hour.closes_at }));
    await saveBusinessHours(tenant.id, tenant.businessHours, nextHours);
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudieron actualizar los horarios" }; }
}

export async function updateDepositSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const depositType = formData.get("depositType");
  const depositValue = Number(formData.get("depositValue") ?? 0);
  const depositMin = Number(formData.get("depositMin") ?? 0);
  if (depositType !== "none" && depositType !== "percent" && depositType !== "fixed") return { error: "Tipo de seña inválido" };
  if (!Number.isFinite(depositValue) || !Number.isFinite(depositMin) || depositValue < 0 || depositMin < 0) return { error: "Ingresá montos válidos" };
  if (depositType === "percent" && depositValue > 100) return { error: "El porcentaje no puede pasar de 100" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await firebaseAdmin().db.collection("tenants").doc(tenant.id).update({ settings: { ...tenant.settings, depositType, depositValue, depositMin }, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/configuracion`);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar la seña" }; }
}

export async function updateMercadoPagoSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  void _prev;
  const feeMode = formData.get("feeMode");
  const feePercent = Number(formData.get("feePercent") ?? 0);
  if (feeMode !== "absorbed" && feeMode !== "passed_through") return { error: "Elegí quién absorbe el costo" };
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 50) return { error: "Ingresá un porcentaje válido" };
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
