import { describe, expect, it } from "vitest";
import { ageFromBirthYear, birthYearFromAge, createClientSchema } from "./client";

describe("edad <-> birthYear", () => {
  it("guarda el año actual menos la edad", () => {
    expect(birthYearFromAge(30, 2026)).toBe(1996);
    expect(birthYearFromAge(1, 2026)).toBe(2025);
  });

  it.each([0, -3, 4.5, 111, Number.NaN])("rechaza la edad %s", (age) => {
    expect(birthYearFromAge(age, 2026)).toBeNull();
  });

  it("es la inversa de birthYearFromAge", () => {
    for (const age of [1, 18, 42, 90]) {
      expect(ageFromBirthYear(birthYearFromAge(age, 2026), 2026)).toBe(age);
    }
  });

  it("devuelve null sin dato o con un año imposible", () => {
    expect(ageFromBirthYear(undefined, 2026)).toBeNull();
    expect(ageFromBirthYear(null, 2026)).toBeNull();
    expect(ageFromBirthYear("1990", 2026)).toBeNull();
    expect(ageFromBirthYear(2030, 2026)).toBeNull();
  });
});

describe("createClientSchema", () => {
  it("acepta el teléfono como lo escribe cualquiera y lo guarda en E.164", () => {
    const parsed = createClientSchema.parse({ fullName: "  Camila Morales ", phone: "11 15 2233-4455", email: "" });
    expect(parsed).toEqual({ fullName: "Camila Morales", phone: "+5491122334455", email: "", age: undefined });
  });

  it("sigue aceptando el formato internacional", () => {
    expect(createClientSchema.parse({ fullName: "Ana", phone: "+5491122334455" }).phone).toBe("+5491122334455");
  });

  it("rechaza un teléfono sin código de área con el ejemplo como ayuda", () => {
    const result = createClientSchema.safeParse({ fullName: "Ana", phone: "2233-4455" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("11 2233 4455");
    expect(result.error?.issues[0]?.message).not.toMatch(/internacional/i);
  });

  it("la edad es opcional y llega como número", () => {
    expect(createClientSchema.parse({ fullName: "Ana", phone: "1122334455", age: "" }).age).toBeUndefined();
    expect(createClientSchema.parse({ fullName: "Ana", phone: "1122334455", age: "34" }).age).toBe(34);
    expect(createClientSchema.safeParse({ fullName: "Ana", phone: "1122334455", age: "abc" }).success).toBe(false);
    expect(createClientSchema.safeParse({ fullName: "Ana", phone: "1122334455", age: "200" }).success).toBe(false);
  });
});
