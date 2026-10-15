"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { updateTenantLogo } from "./actions";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SIDE_PX = 512;

// Se reescala en el navegador antes de subir: una foto de 2 MB guardada
// tal cual en base64 no entra en un documento de Firestore (1 MB) ni en el
// cuerpo por defecto de un server action.
async function compressImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No pudimos leer la imagen"));
      img.src = url;
    });
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No pudimos procesar la imagen");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogoUploader({ tenantSlug, tenantName, logoUrl }: { tenantSlug: string; tenantName: string; logoUrl: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(logoUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(dataUrl: string | null, message: string) {
    startTransition(async () => {
      const result = await updateTenantLogo(tenantSlug, dataUrl);
      if (result.error) {
        setError(result.error);
        setPreview(logoUrl);
        return;
      }
      toast.show(message);
      router.refresh();
    });
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Elegí una imagen PNG, JPG o WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("La imagen pesa más de 2 MB. Probá con una más liviana.");
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      setPreview(dataUrl);
      save(dataUrl, "¡Logo actualizado!");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos procesar la imagen");
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-inner bg-surface-container-low p-md">
      <Avatar name={tenantName} src={preview} size="xl" className="ring-2 ring-surface" />
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-label-md text-label-md text-on-surface">Logo del local</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">PNG, JPG o WebP de hasta 2 MB.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Elegir logo"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <Button type="button" size="sm" className="min-h-11" disabled={pending} onClick={() => inputRef.current?.click()}>
            <Icon name="upload" className="text-[16px]" />
            {pending ? "Subiendo…" : preview ? "Cambiar logo" : "Subir logo"}
          </Button>
          {preview && !pending && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setPreview(null);
                save(null, "Quitamos el logo.");
              }}
            >
              Quitar
            </Button>
          )}
        </div>
        {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
      </div>
    </div>
  );
}
