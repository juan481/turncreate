import { z } from "zod";
import { normalizeArPhone, PHONE_HINT } from "@/lib/phone";

export const MAX_CLIENT_AGE = 110;

/** Año de nacimiento aproximado a partir de la edad que dice la clienta (solo se guarda el año). */
export function birthYearFromAge(age: number, currentYear: number): number | null {
  if (!Number.isInteger(age) || age < 1 || age > MAX_CLIENT_AGE) return null;
  return currentYear - age;
}

/** Edad (aproximada, ±1 según si ya cumplió este año) a partir del año guardado. */
export function ageFromBirthYear(birthYear: unknown, currentYear: number): number | null {
  if (typeof birthYear !== "number" || !Number.isInteger(birthYear)) return null;
  const age = currentYear - birthYear;
  return age >= 0 && age <= MAX_CLIENT_AGE + 1 ? age : null;
}

export const PHONE_ERROR = `Revisá el teléfono. ${PHONE_HINT}`;

export const createClientSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre completo"),
  // Se acepta como lo escribe cualquiera ("11 2233-4455", "011 15...") y se guarda en E.164.
  phone: z
    .string({ error: "Ingresá el teléfono" })
    .trim()
    .min(1, "Ingresá el teléfono")
    .transform((value, ctx) => {
      const e164 = normalizeArPhone(value);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: PHONE_ERROR });
        return z.NEVER;
      }
      return e164;
    }),
  email: z.email("Email inválido").optional().or(z.literal("")),
  age: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
    z
      .number({ error: "La edad tiene que ser un número" })
      .int("La edad va sin decimales")
      .min(1, "Revisá la edad")
      .max(MAX_CLIENT_AGE, "Revisá la edad")
      .optional(),
  ),
});

export type CreateClientInput = z.output<typeof createClientSchema>;
