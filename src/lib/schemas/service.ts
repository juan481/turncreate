import { z } from "zod";

export const UNCATEGORIZED_CATEGORY_NAME = "Otros servicios";

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
  durationMin: z.coerce
    .number()
    .int("La duración va en minutos enteros")
    .min(5, "La duración mínima es de 5 minutos")
    .max(720, "La duración máxima es de 12 horas"),
  public: z.boolean().default(true),
});

export const catalogOrderSchema = z.object({
  categoryIds: z.array(serviceCategoryIdSchema).max(200),
  serviceIds: z.array(serviceIdSchema).max(1000),
});
