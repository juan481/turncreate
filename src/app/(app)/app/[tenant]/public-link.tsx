"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export function PublicLink({ url, hint }: { url: string; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API puede fallar (permisos del navegador) -- el link
      // sigue visible y seleccionable a mano, no hace falta más.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-inner bg-surface-container-low p-md">
      <div className="min-w-0">
        <p className="font-label-sm text-label-sm text-on-surface-variant">Tu turnero público</p>
        <p className="truncate font-label-md text-label-md text-on-surface">{url}</p>
        {hint && <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
          <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
          {copied ? "Copiado" : "Copiar"}
        </Button>
        <a href={url} target="_blank" rel="noopener" className="inline-flex">
          <Button type="button" variant="secondary" size="sm">
            <Icon name="open_in_new" className="text-[16px]" />
            Abrir
          </Button>
        </a>
      </div>
    </div>
  );
}
