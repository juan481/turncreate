/**
 * El catálogo de servicios no guarda una categoría propia (ver
 * firestore: tenants/{id}/services solo tiene name/price/phases), así
 * que el ícono se infiere por palabras clave del nombre. Cubre tanto
 * rubros de peluquería/barbería como de estética (uñas, pestañas, piel).
 */
const RULES: [RegExp, string][] = [
  [/corte|barba|afeitad/i, "content_cut"],
  [/u[ñn]a|manicur|pedicur|kapping|escultur|esculpid|soft ?gel|polygel|baby boomer|nail/i, "back_hand"],
  [/pie[ds]/i, "footprint"],
  [/cej/i, "face"],
  [/pesta[ñn]|lash|lifting/i, "visibility"],
  [/micropigmentaci[oó]n|microblading/i, "colorize"],
  [/facial|peeling|microneedling|exosomas|hidralips|dermaplaning|piel|skin|limpieza/i, "spa"],
  [/depilaci[oó]n|bozo|ment[oó]n|barbilla|frente/i, "spa"],
  [/pack|promo|experiencia/i, "diamond"],
  [/color|tinte|brushing|tratamiento capilar/i, "palette"],
];

export function iconForService(name: string): string {
  for (const [pattern, icon] of RULES) {
    if (pattern.test(name)) return icon;
  }
  return "content_cut";
}
