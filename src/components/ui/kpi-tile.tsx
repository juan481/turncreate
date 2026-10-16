import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de métrica (home, Reportes): ícono en chip + etiqueta chica,
 * número protagonista, línea secundaria opcional.
 *  - `emphasis`: la métrica principal de la pantalla (ej. "Cobrado hoy"),
 *    con el degradé de marca y el número más grande. Una por pantalla.
 *  - El valor lleva `tabular-nums` (los dígitos no bailan de ancho) y
 *    `truncate` dentro de un contenedor `min-w-0`: en una grilla 2x2 a
 *    320px cada tile tiene ~105px útiles, así que la plata grande conviene
 *    pasarla ya compacta ("$1,25 M") y dejar el valor completo en `title`.
 *  - El hint NO trunca: "+15% vs. mes pasado" cortado a mitad de palabra
 *    se leía peor que en dos líneas (line-clamp-2 como tope).
 */
export function KpiTile({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon,
  href,
  emphasis = false,
  title,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: "neutral" | "positive" | "warning";
  icon?: ReactNode;
  href?: string;
  emphasis?: boolean;
  /** Tooltip / valor completo cuando `value` va abreviado. */
  title?: string;
  className?: string;
}) {
  const content = (
    <>
      <div className={cn("flex min-w-0 items-center gap-2 font-label-sm text-label-sm", emphasis ? "text-on-primary/85" : "text-on-surface-variant")}>
        {icon && (
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-[15px]",
              emphasis ? "bg-white/20 text-on-primary" : "bg-secondary-soft text-secondary",
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 line-clamp-2 break-words leading-tight">{label}</span>
      </div>
      <div
        title={title}
        className={cn(
          "min-w-0 truncate tabular-nums",
          emphasis
            ? "font-headline-xl-mobile text-headline-xl-mobile text-on-primary"
            : "font-headline-md text-headline-md text-on-surface",
        )}
      >
        {value}
      </div>
      {hint && (
        <div
          className={cn(
            "line-clamp-2 font-label-sm text-label-sm leading-tight tabular-nums",
            emphasis
              ? "text-on-primary/85"
              : hintTone === "positive"
                ? "text-status-confirmed"
                : hintTone === "warning"
                  ? "text-status-draft"
                  : "text-on-surface-variant",
          )}
        >
          {hint}
        </div>
      )}
    </>
  );
  const sharedClassName = cn(
    "relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-inner border p-3.5",
    emphasis
      ? "border-transparent bg-gradient-to-br from-primary-light via-primary to-primary-deep shadow-fab"
      : "border-border bg-surface-container-lowest shadow-card",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          sharedClassName,
          "transition-transform motion-safe:active:scale-[0.98]",
          !emphasis && "active:bg-surface-container-low",
        )}
      >
        {content}
      </Link>
    );
  }
  return <div className={sharedClassName}>{content}</div>;
}
