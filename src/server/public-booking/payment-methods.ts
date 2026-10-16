import type { TransferSettings } from "@/server/firebase/tenants";
import { normalizeArPhone } from "@/lib/phone";

// Lógica pura de "cómo puede pagar la seña la clienta" en el turnero
// público. Sin Firestore: la usan getPublicTenant, el hub de Configuración
// y las server actions, y se testea sola.

const HOUR_MS = 60 * 60_000;

/** Plazo máximo para que la dueña confirme el comprobante antes de que el cron libere el horario. */
export const TRANSFER_CONFIRM_WINDOW_HOURS = 12;
/** Turnos que empiezan antes de esto no se ofrecen con transferencia (solo Mercado Pago). */
export const TRANSFER_MIN_LEAD_HOURS = 2;
/** El pendiente vence, como tarde, esta cantidad de horas antes del turno. */
export const TRANSFER_DEADLINE_BEFORE_START_HOURS = 1;
/** Transferencias sin confirmar que puede tener abiertas un mismo WhatsApp en un local. */
export const MAX_PENDING_TRANSFERS_PER_PHONE = 2;

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

/** ¿Hay margen para esperar una transferencia antes de este turno? */
export function transferAllowedFor(startsAt: Date, now: Date = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= TRANSFER_MIN_LEAD_HOURS * HOUR_MS;
}

/**
 * Hasta cuándo se espera el comprobante: el plazo normal, pero nunca más
 * tarde que una hora antes del turno (si no, el horario quedaría ocupado
 * por alguien que no pagó justo cuando ya no se puede volver a ofrecer).
 * null si el turno está demasiado cerca para ofrecer transferencia.
 */
export function transferDeadline(startsAt: Date, now: Date = new Date()): Date | null {
  if (!transferAllowedFor(startsAt, now)) return null;
  return new Date(Math.min(
    now.getTime() + TRANSFER_CONFIRM_WINDOW_HOURS * HOUR_MS,
    startsAt.getTime() - TRANSFER_DEADLINE_BEFORE_START_HOURS * HOUR_MS,
  ));
}

/** "Vence en 3 h 20 min" / "Vence en 45 min" / "Vencida" para la lista de la dueña. */
export function transferTimeLeftLabel(expiresAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((expiresAt.getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "Vencida";
  if (minutes < 60) return `Vence en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `Vence en ${hours} h` : `Vence en ${hours} h ${rest} min`;
}

/** "$5.000" (con centavos solo si los hay). */
export function moneyLabel(amount: number): string {
  return `$${amount.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

/** Monto tal cual se tipea en la app del banco: sin separador de miles ("5000" o "5000,50"). */
export function moneyToCopy(amount: number): string {
  return amount.toLocaleString("es-AR", { maximumFractionDigits: 2, useGrouping: false });
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
