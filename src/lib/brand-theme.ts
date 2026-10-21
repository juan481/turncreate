import type { CSSProperties } from "react";

export const BRAND_COLOR_IDS = ["iris", "rose", "emerald", "ocean", "amber"] as const;

export type BrandColorId = (typeof BRAND_COLOR_IDS)[number];

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

/**
 * Paletas cerradas y con contraste AA sobre blanco. Mantenerlas como fuente
 * de verdad evita guardar hex arbitrarios y garantiza que botones, foco y
 * estados seleccionados sigan siendo legibles en el panel y el turnero.
 */
export const BRAND_PALETTES: Record<BrandColorId, BrandPalette> = {
  iris: {
    id: "iris",
    label: "Violeta",
    primary: "#5b52d6",
    hover: "#4c43c4",
    light: "#8f88f5",
    deep: "#3d35a8",
    glow: "#c4b5fd",
    soft: "#f3f1ff",
    onPrimary: "#ffffff",
  },
  rose: {
    id: "rose",
    label: "Rosa",
    primary: "#b83267",
    hover: "#9d2957",
    light: "#e46a96",
    deep: "#7f2047",
    glow: "#f7b8cf",
    soft: "#fff0f5",
    onPrimary: "#ffffff",
  },
  emerald: {
    id: "emerald",
    label: "Esmeralda",
    primary: "#087f5b",
    hover: "#066b4c",
    light: "#25a77b",
    deep: "#05533e",
    glow: "#a7e8d1",
    soft: "#edfcf6",
    onPrimary: "#ffffff",
  },
  ocean: {
    id: "ocean",
    label: "Azul",
    primary: "#1565c0",
    hover: "#0d54a3",
    light: "#4b8fdf",
    deep: "#0a4182",
    glow: "#b9d8fa",
    soft: "#eef6ff",
    onPrimary: "#ffffff",
  },
  amber: {
    id: "amber",
    label: "Ámbar",
    primary: "#934900",
    hover: "#783b00",
    light: "#ce7714",
    deep: "#5f2f00",
    glow: "#f6d39e",
    soft: "#fff6e8",
    onPrimary: "#ffffff",
  },
};

export const DEFAULT_BRAND_COLOR: BrandColorId = "iris";

export function isBrandColorId(value: unknown): value is BrandColorId {
  return typeof value === "string" && (BRAND_COLOR_IDS as readonly string[]).includes(value);
}

export function normalizeBrandColor(value: unknown): BrandColorId {
  return isBrandColorId(value) ? value : DEFAULT_BRAND_COLOR;
}

export function brandThemeStyle(value: unknown): CSSProperties {
  const palette = BRAND_PALETTES[normalizeBrandColor(value)];
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
