"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { isStorableImageDataUrl, requireTenantAccess, saveBusinessHours } from "@/server/firebase/tenants";
import { flatHoursError, type FlatHours } from "@/components/ui/hours-editor-model";
import { disconnectMp, getMpConnection } from "@/server/mercadopago/connections";
import { bookingAvailability } from "@/server/public-booking/payment-methods";
import { normalizeArPhone } from "@/lib/phone";
import { DESCRIPTION_MAX_LENGTH, normalizeDescription, normalizeInstagramUrl } from "@/server/tenant-profile";
import { validateTransfer, type TransferFieldErrors } from "./transfer-validation";

export type ConfigActionState = { error: string | null; success?: boolean };
export type TransferActionState = ConfigActionState & { fieldErrors?: TransferFieldErrors };

// 00:00 a 23:59: el regex del editor solo miraba el formato y aceptaba "25:00".
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function tenantForUser(slug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return requireTenantAccess(user.uid, slug);
}

const tenantDoc = (tenantId: string) => firebaseAdmin().db.collection("tenants").doc(tenantId);

/**
 * Todo lo de Configuración se ve en el hub, en su sub-pantalla, en la home
 * (pasos de "Terminá de preparar tu turnero") y en el turnero público:
 * se refresca el layout del local entero + la página pública.
 */
function revalidateTenant(slug: string) {
  revalidatePath(`/app/${slug}`, "layout");
  revalidatePath(`/${slug}`);
}

// Las escrituras de `settings` van SIEMPRE con field paths con punto
// ("settings.depositType"), nunca con `settings: { ...tenant.settings, ... }`:
// el spread reescribe el mapa entero con lo que se leyó al principio del
// request y pisa cualquier cambio hecho en paralelo (otra pestaña, el
// callback de Mercado Pago que prende publicBookingEnabled, etc.).

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
    await tenantDoc(tenant.id).update({
      name: name.trim(), description, address: String(formData.get("address") || "").trim() || null,
      instagramUrl,
      whatsappNumber,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTenant(tenantSlug);
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
    await tenantDoc(tenant.id).update({ logoUrl: dataUrl, updatedAt: FieldValue.serverTimestamp() });
    revalidateTenant(tenantSlug);
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
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudieron actualizar los horarios" }; }
}

export async function updateDepositSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  const depositType = formData.get("depositType");
  if (depositType !== "none" && depositType !== "percent" && depositType !== "fixed") return { error: "Tipo de seña inválido" };
  const depositValue = Number(formData.get("depositValue") ?? 0);
  const depositMin = Number(formData.get("depositMin") ?? 0);
  if (depositType !== "none") {
    if (!Number.isFinite(depositValue) || !Number.isFinite(depositMin) || depositValue < 0 || depositMin < 0) return { error: "Ingresá montos válidos" };
    if (depositType === "percent" && depositValue > 100) return { error: "El porcentaje no puede pasar de 100" };
    if (depositValue <= 0 && depositMin <= 0) return { error: "Ingresá cuánto pedís de seña" };
  }
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    // "Sin seña" solo cambia el tipo: los montos quedan guardados para
    // cuando la vuelva a activar (el form ni los manda en ese caso).
    await tenantDoc(tenant.id).update(
      depositType === "none"
        ? { "settings.depositType": depositType, updatedAt: FieldValue.serverTimestamp() }
        : {
            "settings.depositType": depositType,
            "settings.depositValue": depositValue,
            "settings.depositMin": depositMin,
            updatedAt: FieldValue.serverTimestamp(),
          },
    );
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar la seña" }; }
}

export async function updateMercadoPagoSettings(tenantSlug: string, _prev: ConfigActionState, formData: FormData): Promise<ConfigActionState> {
  void _prev;
  const feeMode = formData.get("feeMode");
  const feePercent = Number(formData.get("feePercent") ?? 0);
  if (feeMode !== "absorbed" && feeMode !== "passed_through") return { error: "Elegí quién paga la comisión" };
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 50) return { error: "Ingresá un porcentaje entre 0 y 49,99" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await tenantDoc(tenant.id).update({
      "settings.mpFeeMode": feeMode,
      "settings.mpFeePercent": Math.round(feePercent * 100) / 100,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar Mercado Pago" }; }
}

/** "Cobrar la seña con Mercado Pago": apagarlo deja la cuenta conectada pero el turnero no la ofrece. */
export async function updateMercadoPagoEnabled(tenantSlug: string, enabled: boolean): Promise<ConfigActionState> {
  if (typeof enabled !== "boolean") return { error: "Valor inválido" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await tenantDoc(tenant.id).update({ "settings.payments.mercadopagoEnabled": enabled, updatedAt: FieldValue.serverTimestamp() });
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar Mercado Pago" }; }
}

export async function disconnectMercadoPago(tenantSlug: string, _prev: ConfigActionState): Promise<ConfigActionState> {
  void _prev;
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await disconnectMp(tenant.id);
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo desconectar Mercado Pago" }; }
}

export async function updateTransferSettings(tenantSlug: string, _prev: TransferActionState, formData: FormData): Promise<TransferActionState> {
  void _prev;
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
  };
  const { value, errors } = validateTransfer({
    enabled: formData.get("enabled") === "on",
    alias: field("alias"),
    cbu: field("cbu"),
    holderName: field("holderName"),
    bankName: field("bankName"),
  });
  if (Object.keys(errors).length > 0) return { error: "Revisá los datos marcados", fieldErrors: errors };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    await tenantDoc(tenant.id).update({ "settings.payments.transfer": value, updatedAt: FieldValue.serverTimestamp() });
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar la transferencia" }; }
}

/**
 * Prender/pausar el turnero público. Prenderlo exige lo mismo que mira el
 * turnero para tomar una reserva (seña + al menos un medio de pago): si no,
 * la dueña vería "activo" y las clientas, un turnero que no deja reservar.
 * Pausarlo se puede siempre.
 */
export async function updatePublicBookingEnabled(tenantSlug: string, enabled: boolean): Promise<ConfigActionState> {
  if (typeof enabled !== "boolean") return { error: "Valor inválido" };
  try {
    const { tenant } = await tenantForUser(tenantSlug);
    if (enabled) {
      const connection = await getMpConnection(tenant.id);
      const availability = bookingAvailability(tenant, connection?.status === "connected");
      if (availability.reason === "no_deposit") return { error: "Primero configurá una seña en Pagos y señas" };
      if (availability.reason === "no_payment_method") return { error: "Primero activá Mercado Pago o la transferencia en Pagos y señas" };
    }
    await tenantDoc(tenant.id).update({ "settings.publicBookingEnabled": enabled, updatedAt: FieldValue.serverTimestamp() });
    revalidateTenant(tenantSlug);
    return { error: null, success: true };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo actualizar el link de reservas" }; }
}
