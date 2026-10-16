import { z } from "zod";

// La foto se muestra en el turnero público: solo https (nada de javascript:,
// data: sin validar o http que el navegador bloquea) y con un largo razonable.
const photoUrl = z
  .url({ protocol: /^https$/, error: "La foto tiene que ser un link https a una imagen (subila a algún servicio y pegá el link)" })
  .max(2048, "El link de la foto es demasiado largo");

export const createStaffSchema = z.object({
  displayName: z.string().trim().min(2, "Ingresá un nombre"),
  photoUrl,
});

export const updateStaffPhotoSchema = z.object({
  photoUrl,
});
