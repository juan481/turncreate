"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

const MEMORY_PREFIX = "tc:ultima-busqueda:";

function rememberedSearch(path: string): string {
  try {
    return sessionStorage.getItem(MEMORY_PREFIX + path) ?? "";
  } catch {
    return "";
  }
}

/**
 * Anota el `?query` con el que se vio cada pantalla por última vez, para
 * que el Volver jerárquico caiga en el padre TAL CUAL lo dejaste (ej. el
 * día que estabas mirando en la agenda), no en su versión "de cero".
 * Usa useSearchParams: montarlo dentro de un <Suspense>.
 */
export function RememberRouteSearch() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(MEMORY_PREFIX + pathname, search ? `?${search}` : "");
    } catch {
      // Sin storage (modo privado, bloqueado): el Volver igual funciona, sin el query.
    }
  }, [pathname, search]);
  return null;
}

/**
 * Volver = ir SIEMPRE al padre jerárquico (`href`), nunca `router.back()`:
 * el historial depende del camino que hiciste, la jerarquía no. El atrás
 * físico del teléfono sigue siendo historial, eso lo maneja el navegador.
 * `fallbackHref` queda como alias del nombre viejo de la prop.
 */
export function BackButton({
  href,
  fallbackHref,
  className,
  variant = "default",
}: ({ href: string; fallbackHref?: never } | { fallbackHref: string; href?: never }) & {
  className?: string;
  /** "default": pill clara (para headers claros). "on-brand": sobre el AppBar violeta. */
  variant?: "default" | "on-brand";
}) {
  const router = useRouter();
  const target = (href ?? fallbackHref) as string;
  return (
    <Link
      href={target}
      aria-label="Volver"
      onNavigate={(event) => {
        const search = rememberedSearch(target);
        if (!search) return;
        event.preventDefault();
        router.push(`${target}${search}`);
      }}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[20px] transition-[background-color,transform] duration-150 motion-safe:active:scale-90",
        variant === "on-brand"
          ? "bg-white/15 text-white hover:bg-white/20 active:bg-white/25"
          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container active:bg-surface-container",
        className,
      )}
    >
      <Icon name="arrow_back" />
    </Link>
  );
}
