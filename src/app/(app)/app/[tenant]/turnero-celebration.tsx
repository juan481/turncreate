"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

// Papelitos: destino fijo (no aleatorio) para que el render sea estable.
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 110 + (i % 3) * 38;
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance + 40)}px`,
    rot: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
    delay: `${(i % 6) * 40}ms`,
    tone: ["bg-primary", "bg-primary-light", "bg-secondary", "bg-status-confirmed-dot", "bg-tertiary"][i % 5],
    shape: i % 3 === 0 ? "h-2 w-2 rounded-full" : "h-3 w-1.5 rounded-[2px]",
  };
});

/**
 * "¡Turnero habilitado!": se muestra al prender las reservas online (paso a
 * paso del home y Configuración → Link de reservas). Portal a <body> porque
 * las transiciones de página usan transform y rompen el `fixed`.
 */
export function TurneroCelebration({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Reservá tu turno", url });
    } catch {
      /* La clienta canceló el diálogo de compartir: nada que hacer. */
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="turnero-habilitado-title">
      <div className="absolute inset-0 bg-scrim/70 backdrop-blur-sm motion-safe:animate-greet-in" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[24rem] rounded-[28px] bg-surface p-6 text-center shadow-brand motion-safe:animate-celebrate-card">
        <div className="relative mx-auto mb-5 grid h-24 w-24 place-items-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-status-confirmed-dot/40 motion-safe:animate-celebrate-ring" />
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/25 motion-safe:animate-celebrate-ring [animation-delay:0.45s]" />
          {CONFETTI.map((piece, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn("absolute left-1/2 top-1/2 opacity-0 motion-safe:animate-confetti motion-reduce:hidden", piece.tone, piece.shape)}
              style={{ "--dx": piece.dx, "--dy": piece.dy, "--rot": piece.rot, animationDelay: piece.delay } as CSSProperties}
            />
          ))}
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-primary-light via-primary to-primary-deep text-on-primary shadow-fab motion-safe:animate-celebrate-check">
            <Icon name="check" className="text-[40px]" />
          </span>
        </div>

        <h2 id="turnero-habilitado-title" className="font-headline-md text-headline-md text-on-surface">¡Turnero habilitado!</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Tus clientas ya pueden reservar y pagar la seña desde este link.</p>

        <div className="mt-5 flex min-w-0 items-center gap-2 rounded-inner border border-border bg-surface-container-low p-2 pl-3 text-left">
          <Icon name="link" className="shrink-0 text-[18px] text-primary" />
          <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface" title={url}>
            {url.replace(/^https?:\/\//, "")}
          </span>
          <Button type="button" size="sm" onClick={copy} className="min-h-11 shrink-0" aria-live="polite">
            <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {canShare && (
            <Button type="button" variant="secondary" onClick={share} className="min-h-11">
              <Icon name="share" className="text-[16px]" />
              Compartir
            </Button>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low",
              !canShare && "sm:col-span-2",
            )}
          >
            <Icon name="open_in_new" className="text-[16px]" />
            Ver mi turnero
          </a>
        </div>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-pill font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Listo
        </button>
      </div>
    </div>,
    document.body,
  );
}
