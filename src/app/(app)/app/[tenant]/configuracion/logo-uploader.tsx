"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ACCEPTED_IMAGE_TYPES, compressImageToDataUrl, validateImageFile } from "@/lib/compress-image";
import { updateTenantLogo } from "./actions";

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
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
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
            accept={ACCEPTED_IMAGE_TYPES}
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
