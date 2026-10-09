import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta de número grande estilo Perladerm (etiqueta chica + valor
 * grande + línea secundaria), para la home y Reportes. `tabular-nums`
 * en el valor para que las cifras no "bailen" de ancho entre
 * actualizaciones (recomendado en DESIGN.md para métricas).
 */
export function KpiTile({
  label,
  value,
  hint,
  hintTone = "neutral",
  icon,
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  hintTone?: "neutral" | "positive" | "warning";
  icon?: ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="font-headline-md text-headline-md tabular-nums text-on-surface">{value}</div>
      {hint && (
        <div
          className={cn(
            "truncate font-label-sm text-label-sm",
            hintTone === "positive" && "text-status-confirmed",
            hintTone === "warning" && "text-status-draft",
            hintTone === "neutral" && "text-on-surface-variant",
          )}
        >
          {hint}
        </div>
      )}
    </>
  );
  const sharedClassName = cn("flex flex-col gap-1 rounded-inner bg-surface-container-low p-3.5", className);

  if (href) {
    return (
      <Link href={href} className={cn(sharedClassName, "transition-colors active:bg-surface-container")}>
        {content}
      </Link>
    );
  }
  return <div className={sharedClassName}>{content}</div>;
}
