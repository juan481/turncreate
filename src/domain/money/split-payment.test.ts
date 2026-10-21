import { describe, expect, it } from "vitest";
import { chargeKind, splitCharge } from "./split-payment";

describe("splitCharge", () => {
  it("registra un cobro simple con servicio y producto", () => {
    expect(splitCharge({ serviceAmount: 8000, productAmount: 2000, primaryMethod: "cash" })).toEqual([
      { method: "cash", grossAmount: 10000, appliedAmount: 8000, productAmount: 2000 },
    ]);
  });

  it("divide un cobro mixto y conserva el total aplicado", () => {
    const parts = splitCharge({ serviceAmount: 10000, primaryMethod: "cash", secondaryMethod: "mercadopago", secondaryAmount: 6000 });
    expect(parts).toEqual([
      { method: "cash", grossAmount: 4000, appliedAmount: 4000, productAmount: 0 },
      { method: "mercadopago", grossAmount: 6000, appliedAmount: 6000, productAmount: 0 },
    ]);
  });

  it("rechaza dos medios iguales o una división vacía", () => {
    expect(() => splitCharge({ serviceAmount: 1000, primaryMethod: "cash", secondaryMethod: "cash", secondaryAmount: 500 })).toThrow("distintos");
    expect(() => splitCharge({ serviceAmount: 1000, primaryMethod: "cash", secondaryMethod: "transfer", secondaryAmount: 1000 })).toThrow("parte");
  });
});

describe("chargeKind", () => {
  it("distingue seña, pago total y saldo", () => {
    expect(chargeKind({ total: 10000, currentBalance: 10000, appliedAmount: 3000 })).toBe("deposit");
    expect(chargeKind({ total: 10000, currentBalance: 10000, appliedAmount: 10000 })).toBe("full");
    expect(chargeKind({ total: 10000, currentBalance: 7000, appliedAmount: 7000 })).toBe("balance");
  });
});
