import { describe, expect, it } from "vitest";
import { cleanPublicClient, tenantPhoneKey } from "./client";

describe("cleanPublicClient", () => {
  it("normaliza el WhatsApp como lo escriba la clienta", () => {
    expect(cleanPublicClient({ full_name: "  Lu   Gómez ", phone_e164: "11 15 2233-4455", email: " LU@Mail.com " })).toEqual({
      fullName: "Lu Gómez",
      phone: "+5491122334455",
      email: "lu@mail.com",
    });
    expect(cleanPublicClient({ full_name: "Lu", phone_e164: "+5491122334455", email: "" }).phone).toBe("+5491122334455");
  });

  it("rechaza datos incompletos con un mensaje claro", () => {
    expect(() => cleanPublicClient({ full_name: "L", phone_e164: "1122334455", email: "" })).toThrow("nombre");
    expect(() => cleanPublicClient({ full_name: "Lu", phone_e164: "123", email: "" })).toThrow("WhatsApp");
    expect(() => cleanPublicClient({ full_name: "Lu", phone_e164: "1122334455", email: "no-es-mail" })).toThrow("email");
  });
});

describe("cleanPublicClient con datos que no vienen del formulario", () => {
  it("no revienta con tipos raros: los trata como vacíos", () => {
    const weird = { full_name: 123, phone_e164: { a: 1 }, email: null } as unknown as Parameters<typeof cleanPublicClient>[0];
    expect(() => cleanPublicClient(weird)).toThrow("nombre");
  });
});

describe("tenantPhoneKey", () => {
  it("usa solo los dígitos, igual que tenantClientPhones", () => {
    expect(tenantPhoneKey("t1", "+5491122334455")).toBe("t1_5491122334455");
  });
});
