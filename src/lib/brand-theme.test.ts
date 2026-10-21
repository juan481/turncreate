import { describe, expect, it } from "vitest";
import { BRAND_PALETTES, brandThemeStyle, normalizeBrandColor } from "./brand-theme";

describe("brand theme", () => {
  it("usa violeta para tenants anteriores al selector", () => {
    expect(normalizeBrandColor(undefined)).toBe("iris");
    const style = brandThemeStyle(undefined) as Record<string, string>;
    expect(style["--color-primary"]).toBe(BRAND_PALETTES.iris.primary);
  });

  it("acepta solamente paletas conocidas", () => {
    expect(normalizeBrandColor("ocean")).toBe("ocean");
    expect(normalizeBrandColor("#000000")).toBe("iris");
  });
});
