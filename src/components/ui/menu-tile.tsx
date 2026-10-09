import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de la botonera de la home (patrón Perladerm: ícono + título +
 * subtítulo con un dato vivo, ej. "5 turnos"). Siempre la misma altura
 * (~74px) y un solo tap a cualquier sección -- nada de menús anidados.
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
      className={cn(
        "flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 transition-colors active:bg-surface-container-low",
        className,
      )}
    >
      <span className="flex size-[42px] shrink-0 items-center justify-center rounded-[10px] bg-secondary-soft text-[22px] text-secondary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-label-lg text-label-lg text-on-surface">{title}</p>
        {subtitle && <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{subtitle}</p>}
      </div>
    </Link>
  );
}
