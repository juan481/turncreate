// Normalización de los datos públicos del local (Configuración → Información
// del local). Funciones puras: las usa la server action y se testean solas.

export const DESCRIPTION_MAX_LENGTH = 240;

const INSTAGRAM_HANDLE = /^[a-z0-9._]{1,30}$/i;

/**
 * "@mi_local", "mi_local", "instagram.com/mi_local" o la URL completa con
 * parámetros -> "https://instagram.com/mi_local". `null` si viene vacío,
 * `undefined` si no se puede interpretar como un usuario de Instagram.
 */
export function normalizeInstagramUrl(input: string): string | null | undefined {
  const raw = input.trim();
  if (!raw) return null;
  let handle = raw;
  const fromUrl = /^(?:https?:\/\/)?(?:www\.|m\.)?instagram\.com\/([^/?#]+)/i.exec(raw);
  if (fromUrl) handle = fromUrl[1];
  else if (/[/:]/.test(raw)) return undefined;
  handle = handle.replace(/^@/, "");
  if (!INSTAGRAM_HANDLE.test(handle)) return undefined;
  return `https://instagram.com/${handle}`;
}

/** "https://instagram.com/mi_local" -> "@mi_local" (para mostrar). */
export function instagramHandle(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /instagram\.com\/([^/?#]+)/i.exec(url);
  return match ? `@${match[1]}` : null;
}

/** Colapsa espacios y saltos de línea repetidos; `null` si queda vacía. */
export function normalizeDescription(input: string): string | null {
  const clean = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return clean ? clean : null;
}
