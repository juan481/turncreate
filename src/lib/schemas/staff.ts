import { z } from "zod";

export const createStaffSchema = z.object({
  displayName: z.string().trim().min(2, "Ingresá un nombre"),
});
