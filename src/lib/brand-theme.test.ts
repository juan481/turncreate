import { describe, expect, it } from "vitest";
import { BRAND_PALETTES, brandThemeStyle, contrastWithWhite, isAllowedBrandColor, normalizeBrandColor } from "./brand-theme";

describe("brand theme", () => {
  it("usa violeta para tenants anteriores al selector", () => {
    expect(normalizeBrandColor(undefined)).toBe("iris");
    const style = brandThemeStyle(undefined) as Record<string, string>;
    expect(style["--color-primary"]).toBe(BRAND_PALETTES.iris.primary);
  });

  it("mantiene compatibilidad con las paletas conocidas", () => {
    expect(normalizeBrandColor("ocean")).toBe("ocean");
    expect(normalizeBrandColor("desconocido")).toBe("iris");
  });

  it("acepta colores personalizados con contraste AA y rechaza los claros", () => {
    expect(isAllowedBrandColor("#16324f")).toBe(true);
    expect(normalizeBrandColor("#16324F")).toBe("#16324f");
    expect(contrastWithWhite("#16324f")).toBeGreaterThanOrEqual(4.5);
    expect(isAllowedBrandColor("#ffffff")).toBe(false);
    expect(normalizeBrandColor("#ffffff")).toBe("iris");
  });

  it("deriva todos los tokens desde el color personalizado", () => {
    const style = brandThemeStyle("#16324f") as Record<string, string>;
    expect(style["--color-primary"]).toBe("#16324f");
    expect(style["--color-secondary"]).toBe("#16324f");
    expect(style["--color-secondary-soft"]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
