import { z } from "zod";

export const createClientSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá el nombre completo"),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "Usá formato internacional, ej: +5491122334455"),
  email: z.email("Email inválido").optional().or(z.literal("")),
});
