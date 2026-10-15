import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// En mobile el ícono va arriba y el nombre abajo: con dos columnas en
// 320-412px, ícono + texto lado a lado cortaba "Configuración", "Tu link de
// reservas"... Desde sm vuelve a la fila horizontal.
export const MENU_TILE_CLASS =
  "flex flex-col items-start gap-2.5 rounded-[14px] border border-border bg-surface p-3.5 text-left transition-colors active:bg-surface-container-low sm:flex-row sm:items-center sm:gap-3";
export const MENU_TILE_ICON_CLASS =
  "flex size-[42px] shrink-0 items-center justify-center rounded-[10px] bg-secondary-soft text-[22px] text-secondary";

/**
 * Tarjeta de la botonera de la home (patrón Perladerm: ícono + título +
 * subtítulo con un dato vivo, ej. "5 turnos"). Un solo tap a cualquier
 * sección -- nada de menús anidados.
 */
export function MenuTile({
  href,
  icon,
  title,
  subtitle,
  className,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(MENU_TILE_CLASS, className)}
    >
      <span className={MENU_TILE_ICON_CLASS}>{icon}</span>
      <div className="w-full min-w-0 flex-1">
        <p className="font-label-lg text-label-lg leading-tight text-on-surface">{title}</p>
        {subtitle && <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{subtitle}</p>}
      </div>
    </Link>
  );
}
