import { describe, expect, it } from "vitest";
import { validateTransfer } from "./transfer-validation";

const base = { enabled: true, alias: "mi.local.mp", cbu: "", holderName: "Ana Pérez", bankName: "" };

describe("validateTransfer", () => {
  it("normaliza alias a minúsculas y deja nulos los opcionales vacíos", () => {
    const { value, errors } = validateTransfer({ ...base, alias: "  Mi.Local.MP " });
    expect(errors).toEqual({});
    expect(value).toEqual({ enabled: true, alias: "mi.local.mp", cbu: null, holderName: "Ana Pérez", bankName: null });
  });

  it("exige alias y titular solo con la transferencia activada", () => {
    expect(validateTransfer({ ...base, alias: "", holderName: "" }).errors).toMatchObject({ alias: expect.any(String), holderName: expect.any(String) });
    expect(validateTransfer({ ...base, enabled: false, alias: "", holderName: "" }).errors).toEqual({});
  });

  it("rechaza alias con caracteres o largo inválidos aunque esté apagada", () => {
    expect(validateTransfer({ ...base, alias: "corto" }).errors.alias).toBeDefined();
    expect(validateTransfer({ ...base, alias: "con espacio" }).errors.alias).toBeDefined();
    expect(validateTransfer({ ...base, alias: "a".repeat(21) }).errors.alias).toBeDefined();
    expect(validateTransfer({ ...base, enabled: false, alias: "ñandú.local" }).errors.alias).toBeDefined();
  });

  it("acepta un CBU de 22 dígitos copiado con espacios y rechaza otros largos", () => {
    const spaced = validateTransfer({ ...base, cbu: "0000003 1000-1234567 8901" });
    expect(spaced.errors).toEqual({});
    expect(spaced.value.cbu).toBe("0000003100012345678901");
    expect(validateTransfer({ ...base, cbu: "123" }).errors.cbu).toBeDefined();
    expect(validateTransfer({ ...base, cbu: "00000031000123456789012" }).errors.cbu).toBeDefined();
    expect(validateTransfer({ ...base, cbu: "000000310001234567890a" }).errors.cbu).toBeDefined();
  });
});
