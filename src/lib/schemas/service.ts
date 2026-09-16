import { z } from "zod";

export const createServiceSchema = z.object({
  name: z.string().trim().min(2, "Ingresá un nombre"),
  price: z.coerce.number().positive("El precio tiene que ser mayor a 0"),
  durationMin: z.coerce.number().int().positive("La duración tiene que ser mayor a 0"),
  bufferAfterMin: z.coerce.number().int().min(0).default(0),
});
