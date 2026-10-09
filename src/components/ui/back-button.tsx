"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * Prioriza volver a la pantalla real anterior (`router.back()`) sobre un
 * destino fijo: así "‹ Volver" desde el detalle de un turno te deja en el
 * día que estabas mirando, no siempre en "hoy". `fallbackHref` sólo entra
 * si no hay historial dentro de la app (entraste por un link directo, p.
 * ej. desde WhatsApp) -- `history.length > 1` es la señal que usa el
 * propio navegador para habilitar/deshabilitar su botón de atrás.
 */
export function BackButton({
  fallbackHref,
  className,
  variant = "default",
}: {
  fallbackHref: string;
  className?: string;
  /** "default": pill clara (para headers claros). "on-brand": sobre el AppBar violeta. */
  variant?: "default" | "on-brand";
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      aria-label="Volver"
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] transition-colors active:scale-95",
        variant === "on-brand"
          ? "bg-white/15 text-white active:bg-white/25"
          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container active:bg-surface-container",
        className,
      )}
    >
      <Icon name="arrow_back" />
    </button>
  );
}
