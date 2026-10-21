import type { CSSProperties } from "react";

export const BRAND_COLOR_IDS = ["iris", "rose", "emerald", "ocean", "amber"] as const;

export type BrandColorId = (typeof BRAND_COLOR_IDS)[number];
export type BrandColorValue = BrandColorId | `#${string}`;

export type BrandPalette = {
  id: BrandColorId;
  label: string;
  primary: string;
  hover: string;
  light: string;
  deep: string;
  glow: string;
  soft: string;
  onPrimary: "#ffffff";
};

export const BRAND_PALETTES: Record<BrandColorId, BrandPalette> = {
  iris: { id: "iris", label: "Violeta", primary: "#5b52d6", hover: "#4c43c4", light: "#8f88f5", deep: "#3d35a8", glow: "#c4b5fd", soft: "#f3f1ff", onPrimary: "#ffffff" },
  rose: { id: "rose", label: "Rosa", primary: "#b83267", hover: "#9d2957", light: "#e46a96", deep: "#7f2047", glow: "#f7b8cf", soft: "#fff0f5", onPrimary: "#ffffff" },
  emerald: { id: "emerald", label: "Esmeralda", primary: "#087f5b", hover: "#066b4c", light: "#25a77b", deep: "#05533e", glow: "#a7e8d1", soft: "#edfcf6", onPrimary: "#ffffff" },
  ocean: { id: "ocean", label: "Azul", primary: "#1565c0", hover: "#0d54a3", light: "#4b8fdf", deep: "#0a4182", glow: "#b9d8fa", soft: "#eef6ff", onPrimary: "#ffffff" },
  amber: { id: "amber", label: "Ámbar", primary: "#934900", hover: "#783b00", light: "#ce7714", deep: "#5f2f00", glow: "#f6d39e", soft: "#fff6e8", onPrimary: "#ffffff" },
};

export const DEFAULT_BRAND_COLOR: BrandColorId = "iris";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isBrandColorId(value: unknown): value is BrandColorId {
  return typeof value === "string" && (BRAND_COLOR_IDS as readonly string[]).includes(value);
}

function rgb(hexColor: string) {
  const value = Number.parseInt(hexColor.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function mix(source: string, target: string, amount: number) {
  const from = rgb(source);
  const to = rgb(target);
  return toHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

function luminance(hexColor: string) {
  const values = Object.values(rgb(hexColor)).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function contrastWithWhite(value: unknown): number {
  const color = typeof value === "string" && HEX_COLOR.test(value) ? value : BRAND_PALETTES.iris.primary;
  return 1.05 / (luminance(color) + 0.05);
}

/** Los botones usan texto blanco: el color elegido debe alcanzar contraste AA. */
export function isAllowedBrandColor(value: unknown): value is BrandColorValue {
  if (isBrandColorId(value)) return true;
  return typeof value === "string" && HEX_COLOR.test(value) && contrastWithWhite(value) >= 4.5;
}

export function normalizeBrandColor(value: unknown): BrandColorValue {
  if (isBrandColorId(value)) return value;
  if (isAllowedBrandColor(value)) return value.toLowerCase() as `#${string}`;
  return DEFAULT_BRAND_COLOR;
}

export function brandColorHex(value: unknown): string {
  const normalized = normalizeBrandColor(value);
  return isBrandColorId(normalized) ? BRAND_PALETTES[normalized].primary : normalized;
}

export function brandPalette(value: unknown): BrandPalette {
  const normalized = normalizeBrandColor(value);
  if (isBrandColorId(normalized)) return BRAND_PALETTES[normalized];
  return {
    id: DEFAULT_BRAND_COLOR,
    label: "Personalizado",
    primary: normalized,
    hover: mix(normalized, "#000000", 0.14),
    light: mix(normalized, "#ffffff", 0.26),
    deep: mix(normalized, "#000000", 0.30),
    glow: mix(normalized, "#ffffff", 0.64),
    soft: mix(normalized, "#ffffff", 0.92),
    onPrimary: "#ffffff",
  };
}

export function brandThemeStyle(value: unknown): CSSProperties {
  const palette = brandPalette(value);
  return {
    "--color-primary": palette.primary,
    "--color-primary-hover": palette.hover,
    "--color-primary-light": palette.light,
    "--color-primary-deep": palette.deep,
    "--color-primary-glow": palette.glow,
    "--color-on-primary": palette.onPrimary,
    "--color-secondary": palette.primary,
    "--color-secondary-soft": palette.soft,
    "--color-on-secondary": palette.onPrimary,
    "--shadow-brand": `0 8px 24px -14px ${palette.primary}b3`,
    "--shadow-fab": `0 10px 22px -8px ${palette.primary}cc`,
  } as CSSProperties;
}
