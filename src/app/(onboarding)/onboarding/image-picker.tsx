"use client";

import { useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ACCEPTED_IMAGE_TYPES, compressImageToDataUrl, validateImageFile } from "@/lib/compress-image";
import { cn } from "@/lib/utils";

// El servidor acepta hasta 400 KB por imagen (MAX_IMAGE_DATA_URL_LENGTH en
// server/firebase/tenants.ts), y el alta manda logo + foto en el MISMO server
// action, que corta en 1 MB de cuerpo. Con 300 KB por imagen quedan las dos
// juntas bien lejos de ese techo. Si el navegador no sabe codificar WebP (cae
// a PNG, mucho más pesado), se reintenta con un lado más chico.
const MAX_DATA_URL_CHARS = 300 * 1024;
const SIZES_PX = [512, 384, 256];

async function compressWithinBudget(file: File) {
  for (const size of SIZES_PX) {
    const dataUrl = await compressImageToDataUrl(file, size);
    if (dataUrl.length <= MAX_DATA_URL_CHARS) return dataUrl;
  }
  throw new Error("No pudimos achicar la imagen lo suficiente. Probá con otra.");
}

/**
 * Selector de imagen opcional del onboarding (logo del local o foto de la
 * dueña): valida tipo y peso antes de comprimir, muestra la vista previa y
 * deja cambiarla o quitarla. Controlado: el wizard guarda el data URL.
 */
export function ImagePicker({
  value,
  onChange,
  shape,
  label,
  hint,
  fallbackName,
  fallbackIcon = "add_photo",
  title,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  shape: "square" | "round";
  label: string;
  hint: string;
  /** Para las iniciales del avatar redondo cuando no hay foto. */
  fallbackName?: string;
  fallbackIcon?: string;
  /** Línea destacada arriba del hint (ej. la bienvenida de la dueña). */
  title?: React.ReactNode;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    try {
      onChange(await compressWithinBudget(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos procesar la imagen. Probá con otra.");
    } finally {
      setBusy(false);
    }
  }

  const preview =
    shape === "round" ? (
      value || fallbackName?.trim() ? (
        <Avatar name={fallbackName?.trim() || "?"} src={value} size="xl" className="ring-4 ring-surface" />
      ) : (
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-surface text-secondary ring-4 ring-surface">
          <Icon name={fallbackIcon} className="text-[28px]" />
        </span>
      )
    ) : (
      <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-inner bg-surface text-secondary ring-4 ring-surface">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL local recién comprimido, next/image no aporta nada acá
          <img src={value} alt="Vista previa del logo" className="h-full w-full object-contain" />
        ) : (
          <Icon name={fallbackIcon} className="text-[28px]" />
        )}
      </span>
    );

  return (
    <div className="flex min-w-0 items-center gap-4 rounded-inner bg-surface-container-low p-md">
      <span className={cn("relative shrink-0", busy && "animate-pulse motion-reduce:animate-none")}>
        {preview}
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-surface/60 text-secondary">
            <Icon name="progress_activity" className="animate-spin text-[22px] motion-reduce:animate-none" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="min-w-0">
          {title && <p className="break-words font-label-lg text-label-lg text-on-surface">{title}</p>}
          <label htmlFor={inputId} className={cn("block font-label-md text-label-md", title ? "text-on-surface-variant" : "text-on-surface")}>
            {label}
          </label>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className="sr-only"
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            // Permite volver a elegir el mismo archivo después de quitarlo.
            event.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" className="min-h-11" disabled={busy} onClick={() => inputRef.current?.click()}>
            <Icon name={value ? "autorenew" : "upload"} className="text-[16px]" />
            {busy ? "Procesando…" : value ? "Cambiar" : "Subir"}
          </Button>
          {value && !busy && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 text-on-surface-variant"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
            >
              <Icon name="delete" className="text-[16px]" />
              Quitar
            </Button>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="font-body-sm text-body-sm text-status-alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
