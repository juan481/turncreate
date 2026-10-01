import { z } from "zod";

export const createStaffSchema = z.object({
  displayName: z.string().trim().min(2, "Ingresá un nombre"),
  photoUrl: z.url("La foto tiene que ser una URL de imagen válida (subila a algún servicio y pegá el link)"),
});

export const updateStaffPhotoSchema = z.object({
  photoUrl: z.url("La foto tiene que ser una URL de imagen válida (subila a algún servicio y pegá el link)"),
});
