import { z } from "zod";

export const UNCATEGORIZED_CATEGORY_NAME = "Otros servicios";

export const phaseSchema = z.object({
  kind: z.enum(["active", "wait"]),
  minutes: z.coerce.number().int().positive("Cada fase necesita minutos mayores a 0"),
});

export const serviceCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ingresá un nombre para la categoría")
    .max(60, "La categoría puede tener hasta 60 caracteres"),
});

export const serviceCategoryIdSchema = z
  .string()
  .trim()
  .min(1, "La categoría no es válida")
  .max(128, "La categoría no es válida")
  .refine((value) => !value.includes("/"), "La categoría no es válida");

export const serviceIdSchema = z
  .string()
  .trim()
  .min(1, "El servicio no es válido")
  .max(128, "El servicio no es válido")
  .refine((value) => !value.includes("/"), "El servicio no es válido");

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre").max(100, "El nombre puede tener hasta 100 caracteres"),
  description: z.string().trim().max(600, "La descripción puede tener hasta 600 caracteres").default(""),
  categoryId: z.string().trim().max(128).nullable().default(null),
  price: z.coerce.number().positive("El precio tiene que ser mayor a 0"),
  bufferAfterMin: z.coerce.number().int().min(0).max(720).default(0),
  public: z.boolean().default(true),
  phases: z
    .array(phaseSchema)
    .min(1, "Agregá al menos una fase")
    .max(12, "Un servicio puede tener hasta 12 fases")
    .refine((phases) => phases.some((p) => p.kind === "active"), {
      message: "Al menos una fase tiene que ser activa (si no, no hay nada que reservar)",
    }),
});
