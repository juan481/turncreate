import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresá tu nombre completo"),
  email: z.email("Ingresá un email válido"),
  password: z
    .string()
    .min(8, "La contraseña necesita al menos 8 caracteres"),
});
