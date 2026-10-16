import { describe, expect, it } from "vitest";
import { normalizeArPhone } from "./phone";

describe("normalizeArPhone", () => {
  it.each([
    ["11 2233-4455", "+5491122334455"],
    ["1122334455", "+5491122334455"],
    ["011 15 2233 4455", "+5491122334455"],
    ["11 15 2233 4455", "+5491122334455"],
    ["0351 15 422 3344", "+5493514223344"],
    ["351 422 3344", "+5493514223344"],
    ["+54 9 11 2233 4455", "+5491122334455"],
    ["5491122334455", "+5491122334455"],
    ["+1 415 555 0100", "+14155550100"],
    // Sin el 9 de celular: misma clienta, misma clave.
    ["+54 11 2233 4455", "+5491122334455"],
    ["541122334455", "+5491122334455"],
    ["+54 011 15 2233 4455", "+5491122334455"],
    ["+54 351 422 3344", "+5493514223344"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeArPhone(input)).toBe(expected);
  });

  it.each(["", "abc", "2233-4455", "123"])("rechaza %j (sin código de área o vacío)", (input) => {
    expect(normalizeArPhone(input)).toBeNull();
  });
});
