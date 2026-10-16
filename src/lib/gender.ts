// Cómo le hablamos a la dueña/dueño: se pregunta en el onboarding y se
// guarda en `users/{uid}.gender`. Sin dato, se usa la forma neutra.
export type Gender = "female" | "male" | "unspecified";

export function isGender(value: unknown): value is Gender {
  return value === "female" || value === "male" || value === "unspecified";
}

/** byGender(g, { female: "Bienvenida", male: "Bienvenido", neutral: "Te damos la bienvenida" }) */
export function byGender(gender: unknown, forms: { female: string; male: string; neutral: string }) {
  if (gender === "female") return forms.female;
  if (gender === "male") return forms.male;
  return forms.neutral;
}
