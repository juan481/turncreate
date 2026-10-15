import { describe, expect, it } from "vitest";
import { checkoutAmounts, grossUp } from "./payment";

describe("grossUp", () => {
  it("redondea hacia arriba para preservar la seÃ±a neta", () => {
    expect(grossUp(10_000, 0.06)).toBe(10_638.3);
  });

  it("rechaza tasas imposibles", () => {
    expect(() => grossUp(10_000, 1)).toThrow("Tasa invÃ¡lida");
  });
});

describe("checkoutAmounts", () => {
  it("no recarga cuando la cuenta absorbe el costo", () => {
    expect(checkoutAmounts({ depositAmount: 10_000, feeMode: "absorbed", feeRate: 0.06 })).toEqual({
      appliedAmount: 10_000,
      grossAmount: 10_000,
      surchargeAmount: 0,
    });
  });
});
