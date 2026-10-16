import { describe, expect, it } from "vitest";
import {
  bookingAvailability,
  isTransferReady,
  moneyLabel,
  moneyToCopy,
  publicPaymentMethods,
  TRANSFER_CONFIRM_WINDOW_HOURS,
  transferAllowedFor,
  transferDeadline,
  transferReceiptMessage,
  transferTimeLeftLabel,
  whatsAppLink,
} from "./payment-methods";

const transfer = { enabled: true, alias: "mi.local.mp", cbu: null, holderName: "Ana Pérez", bankName: null };

function tenant(overrides: { depositType?: "none" | "fixed" | "percent"; mercadopagoEnabled?: boolean; transfer?: Partial<typeof transfer> | null } = {}) {
  return {
    settings: {
      depositType: overrides.depositType ?? "fixed",
      payments: { mercadopagoEnabled: overrides.mercadopagoEnabled, transfer: overrides.transfer === undefined ? null : overrides.transfer },
    },
  };
}

describe("isTransferReady", () => {
  it("necesita estar habilitada, con alias y titular", () => {
    expect(isTransferReady(transfer)).toBe(true);
    expect(isTransferReady({ ...transfer, enabled: false })).toBe(false);
    expect(isTransferReady({ ...transfer, alias: "  " })).toBe(false);
    expect(isTransferReady({ ...transfer, holderName: "" })).toBe(false);
    expect(isTransferReady(null)).toBe(false);
  });
});

describe("publicPaymentMethods", () => {
  it("Mercado Pago queda prendido por default si la cuenta está conectada", () => {
    expect(publicPaymentMethods(tenant(), true)).toEqual({ mercadopago: true, transfer: false });
    expect(publicPaymentMethods(tenant(), false)).toEqual({ mercadopago: false, transfer: false });
  });

  it("la dueña puede apagar Mercado Pago aunque esté conectado", () => {
    expect(publicPaymentMethods(tenant({ mercadopagoEnabled: false, transfer }), true)).toEqual({ mercadopago: false, transfer: true });
  });
});

describe("bookingAvailability", () => {
  it("sin seña no hay reserva online", () => {
    expect(bookingAvailability(tenant({ depositType: "none" }), true)).toMatchObject({ enabled: false, reason: "no_deposit" });
  });

  it("sin ningún medio de pago tampoco", () => {
    expect(bookingAvailability(tenant({ mercadopagoEnabled: false }), true)).toMatchObject({ enabled: false, reason: "no_payment_method" });
  });

  it("con transferencia sola alcanza", () => {
    expect(bookingAvailability(tenant({ transfer }), false)).toMatchObject({ enabled: true, reason: null, methods: { mercadopago: false, transfer: true } });
  });
});

describe("whatsAppLink", () => {
  it("normaliza el número del local y codifica el mensaje", () => {
    const message = transferReceiptMessage({ clientName: " Lu ", serviceName: "Kapping", whenLabel: "sábado 10/10 a las 10:00", amountLabel: "$5.000" });
    expect(message).toContain("Soy Lu.");
    const link = whatsAppLink("11 2233-4455", message);
    expect(link?.startsWith("https://wa.me/5491122334455?text=")).toBe(true);
    expect(decodeURIComponent(link!.split("text=")[1])).toBe(message);
  });

  it("sin número válido no hay link", () => {
    expect(whatsAppLink(null, "hola")).toBeNull();
    expect(whatsAppLink("123", "hola")).toBeNull();
  });
});

const HOUR = 60 * 60_000;
const NOW = new Date("2026-10-16T12:00:00.000Z");
const inHours = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

describe("transferAllowedFor / transferDeadline", () => {
  it("con menos de 2 h de anticipación no se ofrece transferencia", () => {
    expect(transferAllowedFor(inHours(1.99), NOW)).toBe(false);
    expect(transferDeadline(inHours(1.5), NOW)).toBeNull();
    expect(transferAllowedFor(inHours(2), NOW)).toBe(true);
  });

  it("un turno lejano vence a las N horas de reservar", () => {
    expect(transferDeadline(inHours(72), NOW)?.getTime()).toBe(inHours(TRANSFER_CONFIRM_WINDOW_HOURS).getTime());
  });

  it("un turno cercano vence una hora antes de empezar, nunca después", () => {
    expect(transferDeadline(inHours(5), NOW)?.getTime()).toBe(inHours(4).getTime());
    expect(transferDeadline(inHours(2), NOW)?.getTime()).toBe(inHours(1).getTime());
  });

  it("el plazo es de 12 h o menos (la dueña tiene que poder confirmarlo en el día)", () => {
    expect(TRANSFER_CONFIRM_WINDOW_HOURS).toBeLessThanOrEqual(12);
  });
});

describe("transferTimeLeftLabel", () => {
  it("muestra horas y minutos, y avisa cuando ya venció", () => {
    expect(transferTimeLeftLabel(new Date(NOW.getTime() + 200 * 60_000), NOW)).toBe("Vence en 3 h 20 min");
    expect(transferTimeLeftLabel(inHours(5), NOW)).toBe("Vence en 5 h");
    expect(transferTimeLeftLabel(new Date(NOW.getTime() + 45 * 60_000), NOW)).toBe("Vence en 45 min");
    expect(transferTimeLeftLabel(new Date(NOW.getTime() - 60_000), NOW)).toBe("Vencida");
  });
});

describe("moneyLabel / moneyToCopy", () => {
  it("formatea como en Argentina y copia sin separador de miles", () => {
    expect(moneyLabel(5000)).toBe("$5.000");
    expect(moneyLabel(1234.5)).toBe("$1.234,5");
    expect(moneyToCopy(5000)).toBe("5000");
    expect(moneyToCopy(1234.5)).toBe("1234,5");
  });
});
