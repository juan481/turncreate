// Textos de la suscripción del local (lo que el local le paga a Just Create):
// banners del layout, estado de "Mi plan" y lo que incluye cada plan.
// Puro (sin Firestore ni Next) para poder testearlo y usarlo desde el layout,
// la página de Mi plan y el hub de Configuración por igual.
import type { BillingAccess, TenantBilling } from "@/lib/billing";
import { PLANS, type PlanId } from "@/lib/plans";
import { formatInTz } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cuántos días antes del fin de la prueba aparece el aviso suave. */
export const TRIAL_WARNING_DAYS = 5;

export const READONLY_MESSAGE = "Por falta de pago tu turnero está interrumpido. Por favor aboná tu plan para seguir usándolo.";
export const CANCELLED_MESSAGE = "Tu suscripción a TurnCreate está dada de baja y tu turnero está interrumpido. Aboná tu plan para seguir usándolo.";

/** "20 de octubre" (o "3 de enero de 2027" si no es este año), en la zona del local. */
export function billingDateLabel(ms: number, timezone: string, now: number = Date.now()): string {
  const year = (instant: number) => formatInTz(new Date(instant), timezone, { year: "numeric" });
  const sameYear = year(ms) === year(now);
  return formatInTz(new Date(ms), timezone, { day: "numeric", month: "long", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Días que faltan (redondeado para arriba: "termina mañana a la tarde" = 1). */
export function daysUntil(ms: number, now: number): number {
  return Math.max(0, Math.ceil((ms - now) / DAY_MS));
}

export type BillingBannerModel =
  | { kind: "readonly"; message: string }
  | { kind: "grace"; message: string }
  | { kind: "trial"; message: string };

/**
 * Qué cartel va arriba de TODAS las pantallas del panel (o ninguno).
 * - readonly: cartel rojo grande con botón de pago.
 * - grace: tira ámbar "regularizalo antes del X".
 * - trial con <= 5 días: tira suave "tu prueba termina el X".
 */
export function billingBanner(access: BillingAccess, timezone: string, now: number = Date.now()): BillingBannerModel | null {
  if (access.level === "readonly") {
    return { kind: "readonly", message: access.reason === "cancelled" ? CANCELLED_MESSAGE : READONLY_MESSAGE };
  }
  if (access.level === "grace") {
    const date = access.until != null ? billingDateLabel(access.until, timezone, now) : null;
    if (access.reason === "trial_ended") {
      return {
        kind: "grace",
        message: date
          ? `Tu prueba terminó. Elegí tu plan antes del ${date} para no cortar tu turnero.`
          : "Tu prueba terminó. Elegí tu plan para no cortar tu turnero.",
      };
    }
    return {
      kind: "grace",
      message: date ? `Tu pago está vencido. Regularizalo antes del ${date} para no cortar tu turnero.` : "Tu pago está vencido. Regularizalo para no cortar tu turnero.",
    };
  }
  if (access.reason === "trial" && access.until != null && access.until - now <= TRIAL_WARNING_DAYS * DAY_MS) {
    return { kind: "trial", message: `Tu prueba termina el ${billingDateLabel(access.until, timezone, now)}.` };
  }
  return null;
}

/**
 * La línea explicativa debajo del estado en "Mi plan". Nunca inventa una
 * fecha: si el dato no está, lo dice sin fecha.
 */
export function billingStatusDetail(billing: TenantBilling, access: BillingAccess, timezone: string, now: number = Date.now()): string {
  const date = (ms: number | null | undefined) => (ms != null ? billingDateLabel(ms, timezone, now) : null);
  switch (billing.status) {
    case "free":
      return "Tenés TurnCreate de cortesía: no tenés que pagar nada por ahora.";
    case "trial": {
      const end = date(billing.trialEndsAt);
      const trialEndsAt = billing.trialEndsAt ?? null;
      if (access.level === "full") {
        if (!end || trialEndsAt == null) return "Estás probando TurnCreate sin cargo.";
        const days = daysUntil(trialEndsAt, now);
        return `Tu prueba termina el ${end}${days > 0 ? ` (te ${days === 1 ? "queda 1 día" : `quedan ${days} días`})` : ""}. Suscribite antes para que tu turnero siga andando.`;
      }
      const graceEnd = date(access.until);
      if (access.level === "grace") return graceEnd ? `Tu prueba terminó. Tenés hasta el ${graceEnd} para elegir tu plan.` : "Tu prueba terminó. Elegí tu plan para seguir.";
      return READONLY_MESSAGE;
    }
    case "active": {
      const end = date(billing.currentPeriodEnd);
      if (access.level === "full") return end ? `Próximo cobro el ${end}. Mercado Pago lo debita solo todos los meses.` : "Mercado Pago debita tu plan solo todos los meses.";
      const graceEnd = date(access.until);
      if (access.level === "grace") return graceEnd ? `No registramos el último pago. Tenés hasta el ${graceEnd} para regularizarlo.` : "No registramos el último pago.";
      return READONLY_MESSAGE;
    }
    case "past_due": {
      const graceEnd = date(access.until);
      if (access.level === "grace") {
        return graceEnd
          ? `Mercado Pago no pudo cobrar tu plan. Tenés hasta el ${graceEnd} para regularizarlo (revisá el medio de pago en Mercado Pago o volvé a suscribirte).`
          : "Mercado Pago no pudo cobrar tu plan. Revisá el medio de pago en Mercado Pago o volvé a suscribirte.";
      }
      return READONLY_MESSAGE;
    }
    case "unpaid":
      return READONLY_MESSAGE;
    case "cancelled": {
      const when = date(billing.cancelledAt);
      return when ? `Diste de baja la suscripción el ${when}. Suscribite de nuevo para volver a usar tu turnero.` : "La suscripción está dada de baja. Suscribite de nuevo para volver a usar tu turnero.";
    }
    default:
      return "";
  }
}

/** "1 profesional (vos)" / "Hasta 5 profesionales". */
export function staffLimitLabel(plan: PlanId): string {
  const max = PLANS[plan].maxStaff;
  return max <= 1 ? "1 profesional (vos)" : `Hasta ${max} profesionales`;
}

/**
 * Qué incluye cada plan, SOLO con lo que el panel hace hoy (sale de PLANS
 * + lo que es igual para todos). Nada de lo que la landing promete y
 * todavía no existe (WhatsApp, multi-sucursal, dominio propio).
 */
export function planIncludes(plan: PlanId): string[] {
  const features = PLANS[plan];
  return [
    features.maxStaff <= 1 ? "Agenda para vos solo/a" : `Agenda propia para hasta ${features.maxStaff} profesionales`,
    ...(features.publicBooking ? ["Link de reservas online con cobro de seña (Mercado Pago o transferencia)"] : []),
    "Clientes con su historial de turnos",
    features.cashSessions ? "Caja diaria con apertura, cierre y arqueo" : "Registro de cobros del día",
    "Reportes de turnos y facturación",
  ];
}
