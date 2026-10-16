import { describe, expect, it } from "vitest";
import { calculateDeposit, clampDepositToPrice } from "./deposit";

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
    const deposit = calculateDeposit(5000, {
      type: "percent",
      value: 10,
      min: 2000,
    });
    expect(deposit).toBe(2000);
  });

  it("nunca cobra más que el precio del servicio", () => {
    expect(calculateDeposit(6000, { type: "fixed", value: 10000, min: 10000 })).toBe(6000);
    expect(calculateDeposit(1000, { type: "percent", value: 10, min: 2000 })).toBe(1000);
    expect(calculateDeposit(0, { type: "fixed", value: 5000, min: 0 })).toBe(0);
  });
});

describe("clampDepositToPrice", () => {
  it("deja la seña entre 0 y el precio del servicio", () => {
    expect(clampDepositToPrice(3000, 10000)).toBe(3000);
    expect(clampDepositToPrice(15000, 10000)).toBe(10000);
    expect(clampDepositToPrice(-50, 10000)).toBe(0);
    expect(clampDepositToPrice(undefined, 10000)).toBe(0);
    expect(clampDepositToPrice(1234.567, 10000)).toBe(1234.57);
  });

  it("rechaza montos no numéricos", () => {
    expect(() => clampDepositToPrice(Number.NaN, 10000)).toThrow();
    expect(() => clampDepositToPrice(Number.POSITIVE_INFINITY, 10000)).toThrow();
  });
});
