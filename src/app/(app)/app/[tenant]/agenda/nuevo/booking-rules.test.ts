import { describe, expect, it } from "vitest";
import { calculateDeposit } from "@/domain/money/deposit";
import { roundMoney } from "@/domain/money/payment";
import { suggestedDepositFor, type DepositRule } from "./booking-rules";

describe("suggestedDepositFor", () => {
  it("sin seña configurada sugiere 0", () => {
    expect(suggestedDepositFor(10000, { type: "none", value: 30, min: 2000 })).toBe(0);
  });

  it("nunca sugiere más que el precio del servicio", () => {
    expect(suggestedDepositFor(6000, { type: "fixed", value: 10000, min: 0 })).toBe(6000);
    expect(suggestedDepositFor(1000, { type: "percent", value: 10, min: 2000 })).toBe(1000);
  });

  it("respeta el mínimo y redondea a centavos como el turnero público", () => {
    expect(suggestedDepositFor(5000, { type: "percent", value: 10, min: 2000 })).toBe(2000);
    expect(suggestedDepositFor(3333, { type: "percent", value: 33, min: 0 })).toBe(1099.89);
  });

  it("da exactamente lo mismo que calculateDeposit (+ roundMoney)", () => {
    const rules: DepositRule[] = [
      { type: "percent", value: 30, min: 0 },
      { type: "percent", value: 15, min: 3000 },
      { type: "fixed", value: 5000, min: 0 },
      { type: "fixed", value: 2000, min: 4000 },
    ];
    for (const price of [0, 999, 4500, 12345.67, 30000]) {
      for (const rule of rules) {
        expect(suggestedDepositFor(price, rule)).toBe(roundMoney(calculateDeposit(price, { type: rule.type as "percent" | "fixed", value: rule.value, min: rule.min })));
      }
    }
  });
});
