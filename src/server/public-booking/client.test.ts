import { describe, expect, it } from "vitest";
import { cleanPublicClient } from "./client";

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
