import { describe, expect, it } from "vitest";
import { calculateDeposit } from "./deposit";

describe("calculateDeposit", () => {
  it("no cobra seña si la política es 'none'", () => {
    expect(calculateDeposit(24000, { type: "none" })).toBe(0);
  });

  it("calcula el porcentaje sobre el total", () => {
    const deposit = calculateDeposit(24000, {
      type: "percent",
      value: 50,
      min: 0,
    });
    expect(deposit).toBe(12000);
  });

  it("usa el monto fijo tal cual", () => {
    const deposit = calculateDeposit(24000, {
      type: "fixed",
      value: 5000,
      min: 0,
    });
    expect(deposit).toBe(5000);
  });

  it("nunca cobra menos que deposit_min, incluso con porcentaje bajo", () => {
    const deposit = calculateDeposit(1000, {
      type: "percent",
      value: 10,
      min: 2000,
    });
    expect(deposit).toBe(2000);
  });
});
