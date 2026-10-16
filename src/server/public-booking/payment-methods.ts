import type { TransferSettings } from "@/server/firebase/tenants";
import { normalizeArPhone } from "@/lib/phone";

// Lógica pura de "cómo puede pagar la seña la clienta" en el turnero
// público. Sin Firestore: la usan getPublicTenant, el hub de Configuración
// y las server actions, y se testea sola.

/** Plazo para que la dueña confirme el comprobante antes de que el cron libere el horario. */
export const TRANSFER_CONFIRM_WINDOW_HOURS = 24;

export type PublicPaymentMethods = { mercadopago: boolean; transfer: boolean };

export type BookingAvailability = {
  enabled: boolean;
  /** Por qué el turnero no toma reservas (null si las toma). */
  reason: "no_deposit" | "no_payment_method" | null;
  methods: PublicPaymentMethods;
};

type TenantPaymentSettings = {
  settings: {
    depositType: "none" | "fixed" | "percent";
    payments?: { mercadopagoEnabled?: boolean; transfer?: Partial<TransferSettings> | null };
  };
};

export function isTransferReady(transfer: Partial<TransferSettings> | null | undefined): transfer is TransferSettings {
  return Boolean(transfer?.enabled && transfer.alias?.trim() && transfer.holderName?.trim());
}

export function publicPaymentMethods(tenant: TenantPaymentSettings, mpConnected: boolean): PublicPaymentMethods {
  return {
    mercadopago: mpConnected && tenant.settings.payments?.mercadopagoEnabled !== false,
    transfer: isTransferReady(tenant.settings.payments?.transfer),
  };
}

export function bookingAvailability(tenant: TenantPaymentSettings, mpConnected: boolean): BookingAvailability {
  const methods = publicPaymentMethods(tenant, mpConnected);
  if (tenant.settings.depositType === "none") return { enabled: false, reason: "no_deposit", methods };
  if (!methods.mercadopago && !methods.transfer) return { enabled: false, reason: "no_payment_method", methods };
  return { enabled: true, reason: null, methods };
}

/** Mensaje prearmado para mandarle el comprobante al local por WhatsApp. */
export function transferReceiptMessage(input: { clientName: string; serviceName: string; whenLabel: string; amountLabel: string }) {
  return `¡Hola! Soy ${input.clientName.trim()}. Te mando el comprobante de la transferencia de la seña (${input.amountLabel}) para ${input.serviceName} el ${input.whenLabel}.`;
}

/** wa.me con el texto ya cargado; null si el local no tiene un WhatsApp válido. */
export function whatsAppLink(phone: string | null | undefined, message: string): string | null {
  const normalized = phone ? normalizeArPhone(phone) : null;
  if (!normalized) return null;
  return `https://wa.me/${normalized.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
