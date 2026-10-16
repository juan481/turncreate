import { describe, expect, it } from "vitest";
import { instagramHandle, normalizeDescription, normalizeInstagramUrl } from "./tenant-profile";

describe("normalizeInstagramUrl", () => {
  it("acepta el usuario como lo escribe cualquiera", () => {
    expect(normalizeInstagramUrl("@mi_local")).toBe("https://instagram.com/mi_local");
    expect(normalizeInstagramUrl("mi.local")).toBe("https://instagram.com/mi.local");
    expect(normalizeInstagramUrl("instagram.com/mi_local")).toBe("https://instagram.com/mi_local");
    expect(normalizeInstagramUrl("https://www.instagram.com/mi_local/?hl=es")).toBe("https://instagram.com/mi_local");
  });

  it("vacío es null y basura es undefined", () => {
    expect(normalizeInstagramUrl("   ")).toBeNull();
    expect(normalizeInstagramUrl("https://facebook.com/mi_local")).toBeUndefined();
    expect(normalizeInstagramUrl("mi local con espacios")).toBeUndefined();
  });
});

describe("instagramHandle", () => {
  it("muestra el @", () => {
    expect(instagramHandle("https://instagram.com/mi_local")).toBe("@mi_local");
    expect(instagramHandle(null)).toBeNull();
  });
});

describe("normalizeDescription", () => {
  it("limpia espacios de más y deja null si no hay texto", () => {
    expect(normalizeDescription("  Uñas   esculpidas \n\n\n\n en Palermo  ")).toBe("Uñas esculpidas \n\n en Palermo");
    expect(normalizeDescription(" \n ")).toBeNull();
  });
});
