import { describe, expect, it } from "vitest";
import { bookingAvailability, isTransferReady, publicPaymentMethods, transferReceiptMessage, whatsAppLink } from "./payment-methods";

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
