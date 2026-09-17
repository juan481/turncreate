import { z } from "zod";

export const phaseSchema = z.object({
  kind: z.enum(["active", "wait"]),
  minutes: z.coerce.number().int().positive("Cada fase necesita minutos mayores a 0"),
});

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre"),
  price: z.coerce.number().positive("El precio tiene que ser mayor a 0"),
  bufferAfterMin: z.coerce.number().int().min(0).default(0),
  phases: z
    .array(phaseSchema)
    .min(1, "Agregá al menos una fase")
    .refine((phases) => phases.some((p) => p.kind === "active"), {
      message: "Al menos una fase tiene que ser activa (si no, no hay nada que reservar)",
    }),
});
