"use client";

import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** Web Share API solo existe en el navegador (y no en todos): en el server siempre es false. */
function useCanShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

export function PublicLinkActions({ url, businessName }: { url: string; businessName: string }) {
  const toast = useToast();
  const canShare = useCanShare();
  const display = url.replace(/^https?:\/\//, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Link copiado: pegalo en tu bio o mandalo por WhatsApp");
    } catch {
      // Sin permiso de portapapeles: al menos que lo vea entero para copiarlo a mano.
      toast.show(url, "info");
    }
  }

  async function share() {
    try {
      await navigator.share({ url, title: `Reservá tu turno en ${businessName}` });
    } catch {
      // Cerró el menú de compartir: no es un error.
    }
  }

  // Ícono arriba y texto abajo: tres botones lado a lado entran a 320px.
  const button = cn(buttonVariants({ variant: "secondary" }), "h-auto min-h-14 min-w-0 flex-col gap-0.5 rounded-inner px-2 py-1.5 sm:flex-row sm:gap-1.5");

  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 rounded-inner bg-surface-container-low px-3 py-2.5">
        <p className="font-label-sm text-label-sm uppercase tracking-wide text-on-surface-variant">Tu link</p>
        <p className="break-all font-label-lg text-label-lg text-on-surface">{display}</p>
      </div>
      <div className={cn("grid gap-2", canShare ? "grid-cols-3" : "grid-cols-2")}>
        <button type="button" onClick={copy} className={button}>
          <Icon name="content_copy" className="shrink-0 text-[16px]" />
          <span className="min-w-0 max-w-full truncate">Copiar</span>
        </button>
        {canShare && (
          <button type="button" onClick={share} className={button}>
            <Icon name="share" className="shrink-0 text-[16px]" />
            <span className="min-w-0 max-w-full truncate">Compartir</span>
          </button>
        )}
        <a href={url} target="_blank" rel="noopener noreferrer" className={button}>
          <Icon name="open_in_new" className="shrink-0 text-[16px]" />
          <span className="min-w-0 max-w-full truncate">Abrir</span>
        </a>
      </div>
    </div>
  );
}
