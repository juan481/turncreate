import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Encabezado de un flujo por pasos: "Paso X de N" + barra segmentada +
 * título del paso actual. El texto del paso va en una región aria-live
 * para que un lector de pantalla anuncie el cambio de paso (la barra es
 * decorativa).
 */
export function StepperHeader({
  current,
  total,
  title,
  className,
}: {
  /** 1-based. */
  current: number;
  total: number;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p aria-live="polite" className="font-label-md text-label-md tabular-nums text-on-surface-variant">
        Paso {current} de {total}
        <span className="sr-only">: {title}</span>
      </p>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-pill transition-colors duration-300 motion-reduce:transition-none",
              i < current ? "bg-primary" : "bg-surface-container-high",
            )}
          />
        ))}
      </div>
      <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
    </div>
  );
}

/**
 * Contenedor de un paso: entra deslizándose desde el lado hacia donde se
 * avanza (mismas animaciones que el onboarding). Pasale un `key` distinto
 * por paso para que la animación corra en cada cambio. Sin animación si
 * el sistema pide movimiento reducido.
 */
export function StepPanel({
  direction,
  className,
  children,
}: {
  direction: "forward" | "back";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        direction === "forward" ? "animate-step-in-right" : "animate-step-in-left",
        "motion-reduce:animate-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
