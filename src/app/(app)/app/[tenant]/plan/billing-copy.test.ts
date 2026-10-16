import { describe, expect, it } from "vitest";
import { billingAccess, type TenantBilling } from "@/lib/billing";
import { billingBanner, billingDateLabel, billingStatusDetail, billingStatusLabel, daysUntil, planIncludes, READONLY_MESSAGE, staffLimitLabel } from "./billing-copy";

const TZ = "America/Argentina/Buenos_Aires";
const DAY = 24 * 60 * 60 * 1000;
// 16/10/2026 12:00 en Buenos Aires (UTC-3).
const NOW = Date.UTC(2026, 9, 16, 15, 0, 0);

function access(billing: TenantBilling | null) {
  return billingAccess(billing, NOW);
}

describe("billingDateLabel", () => {
  it("formatea en la zona del local, sin año si es este año", () => {
    expect(billingDateLabel(Date.UTC(2026, 9, 20, 15), TZ, NOW)).toBe("20 de octubre");
  });

  it("usa la zona del local, no la del servidor (00:30 UTC del 21 = 20 en BA)", () => {
    expect(billingDateLabel(Date.UTC(2026, 9, 21, 0, 30), TZ, NOW)).toBe("20 de octubre");
  });

  it("agrega el año si no es el actual", () => {
    expect(billingDateLabel(Date.UTC(2027, 0, 3, 15), TZ, NOW)).toBe("3 de enero de 2027");
  });
});

describe("daysUntil", () => {
  it("redondea para arriba y nunca da negativo", () => {
    expect(daysUntil(NOW + DAY / 2, NOW)).toBe(1);
    expect(daysUntil(NOW + 3 * DAY, NOW)).toBe(3);
    expect(daysUntil(NOW - DAY, NOW)).toBe(0);
  });
});

describe("billingBanner", () => {
  it("sin billing (local viejo) o cortesía: sin cartel", () => {
    expect(billingBanner(access(null), TZ, NOW)).toBeNull();
    expect(billingBanner(access({ status: "free", plan: "solo" }), TZ, NOW)).toBeNull();
  });

  it("al día: sin cartel", () => {
    expect(billingBanner(access({ status: "active", plan: "equipo", currentPeriodEnd: NOW + 20 * DAY }), TZ, NOW)).toBeNull();
  });

  it("prueba con más de 5 días: sin cartel; con 5 o menos: tira suave", () => {
    expect(billingBanner(access({ status: "trial", plan: "solo", trialEndsAt: NOW + 10 * DAY }), TZ, NOW)).toBeNull();
    expect(billingBanner(access({ status: "trial", plan: "solo", trialEndsAt: NOW + 4 * DAY }), TZ, NOW)).toEqual({
      kind: "trial",
      message: "Tu prueba termina el 20 de octubre.",
    });
  });

  it("pago vencido dentro de la gracia: tira ámbar con la fecha de corte", () => {
    const banner = billingBanner(access({ status: "active", plan: "equipo", currentPeriodEnd: NOW - DAY }), TZ, NOW);
    expect(banner).toEqual({ kind: "grace", message: "Tu pago está vencido. Regularizalo antes del 18 de octubre para no cortar tu turnero." });
  });

  it("prueba terminada dentro de la gracia: pide elegir plan", () => {
    const banner = billingBanner(access({ status: "trial", plan: "solo", trialEndsAt: NOW - DAY }), TZ, NOW);
    expect(banner?.kind).toBe("grace");
    expect(banner?.message).toContain("Tu prueba terminó");
  });

  it("interrumpido: cartel de falta de pago", () => {
    expect(billingBanner(access({ status: "unpaid", plan: "pro" }), TZ, NOW)).toEqual({ kind: "readonly", message: READONLY_MESSAGE });
    expect(billingBanner(access({ status: "active", plan: "pro", currentPeriodEnd: NOW - 10 * DAY }), TZ, NOW)?.kind).toBe("readonly");
  });

  it("dado de baja: también readonly, con su propio texto", () => {
    const banner = billingBanner(access({ status: "cancelled", plan: "pro" }), TZ, NOW);
    expect(banner?.kind).toBe("readonly");
    expect(banner?.message).toContain("dada de baja");
  });
});

describe("billingStatusDetail", () => {
  it("cortesía", () => {
    const billing: TenantBilling = { status: "free", plan: "equipo" };
    expect(billingStatusDetail(billing, access(billing), TZ, NOW)).toBe("Tenés TurnCreate de cortesía: no tenés que pagar nada por ahora.");
  });

  it("al día muestra el próximo cobro", () => {
    const billing: TenantBilling = { status: "active", plan: "equipo", currentPeriodEnd: Date.UTC(2026, 10, 5, 15) };
    expect(billingStatusDetail(billing, access(billing), TZ, NOW)).toContain("Próximo cobro el 5 de noviembre");
  });

  it("prueba en curso cuenta los días", () => {
    const billing: TenantBilling = { status: "trial", plan: "solo", trialEndsAt: NOW + 3 * DAY };
    expect(billingStatusDetail(billing, access(billing), TZ, NOW)).toContain("te quedan 3 días");
  });
});

describe("planIncludes / staffLimitLabel", () => {
  it("Solo no promete caja con arqueo; Equipo sí", () => {
    expect(planIncludes("solo").join(" ")).not.toContain("arqueo");
    expect(planIncludes("equipo").join(" ")).toContain("arqueo");
  });

  it("límites de profesionales", () => {
    expect(staffLimitLabel("solo")).toBe("1 profesional (vos)");
    expect(staffLimitLabel("equipo")).toBe("Hasta 5 profesionales");
    expect(staffLimitLabel("pro")).toBe("Hasta 15 profesionales");
  });
});

describe("baja programada (cancelAtPeriodEnd)", () => {
  const scheduled = (end: number): TenantBilling => ({ status: "active", plan: "equipo", currentPeriodEnd: end, cancelAtPeriodEnd: true });

  it("dentro del período: etiqueta 'Baja programada' y detalle con la fecha de corte", () => {
    const billing = scheduled(Date.UTC(2026, 10, 5, 15));
    expect(billingStatusLabel(billing, access(billing))).toBe("Baja programada");
    expect(billingStatusDetail(billing, access(billing), TZ, NOW)).toContain("hasta el 5 de noviembre");
  });

  it("aviso suave solo a 5 días o menos del corte", () => {
    const far = scheduled(NOW + 20 * DAY);
    expect(billingBanner(access(far), TZ, NOW, far)).toBeNull();
    const near = scheduled(NOW + 2 * DAY);
    expect(billingBanner(access(near), TZ, NOW, near)).toEqual({ kind: "trial", message: "Diste de baja tu plan: tu turnero se interrumpe el 18 de octubre." });
  });

  it("pasado el período: dado de baja y cartel rojo", () => {
    const billing = scheduled(NOW - DAY);
    expect(billingStatusLabel(billing, access(billing))).toBe("Dado de baja");
    expect(billingBanner(access(billing), TZ, NOW, billing)?.kind).toBe("readonly");
  });

  it("sin baja programada la etiqueta es la de siempre", () => {
    const billing: TenantBilling = { status: "active", plan: "pro", currentPeriodEnd: NOW + 10 * DAY };
    expect(billingStatusLabel(billing, access(billing))).toBe("Al día");
  });
});
