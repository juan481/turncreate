import { z } from "zod";

export const createTimeBlockSchema = z
  .object({
    staffId: z.string().optional(),
    startsAt: z.string().min(1, "Falta el inicio"),
    endsAt: z.string().min(1, "Falta el fin"),
    kind: z.enum(["vacation", "sick_leave", "break", "other"]),
    reason: z.string().trim().optional(),
  })
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "El fin tiene que ser posterior al inicio",
    path: ["endsAt"],
  });
