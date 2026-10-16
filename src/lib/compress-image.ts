// Solo navegador. Reescala antes de subir: una foto de 2 MB en base64 no
// entra en un documento de Firestore (1 MB) ni en el cuerpo por defecto de
// un server action (1 MB). Con 512px de lado queda en ~50-150 KB.
export const MAX_IMAGE_FILE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

export function validateImageFile(file: File): string | null {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return "Elegí una imagen PNG, JPG o WebP.";
  if (file.size > MAX_IMAGE_FILE_BYTES) return "La imagen pesa más de 2 MB. Probá con una más liviana.";
  return null;
}

export async function compressImageToDataUrl(file: File, maxSidePx = 512): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No pudimos leer la imagen"));
      img.src = url;
    });
    const scale = Math.min(1, maxSidePx / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No pudimos procesar la imagen");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    if (webp.startsWith("data:image/webp")) return webp;
    // Safari viejo no codifica WebP: PNG solo si el original es PNG (logos con
    // transparencia); una foto en PNG pesa varias veces más que en JPEG.
    return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
