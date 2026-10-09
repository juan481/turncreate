import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-10 text-center", className)}>
      {icon && (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-surface-container-low text-[24px] text-on-surface-variant">
          {icon}
        </span>
      )}
      <p className="font-label-lg text-label-lg text-on-surface">{title}</p>
      {/* max-w-[20rem] a propósito, no max-w-xs: en este theme esos nombres
          cortos resuelven contra la escala de spacing (xs = 0.25rem), no
          contra el ancho de contenedor de Tailwind (ver nota en globals.css). */}
      {description && (
        <p className="max-w-[20rem] font-body-sm text-body-sm text-on-surface-variant">{description}</p>
      )}
      {action}
    </div>
  );
}
