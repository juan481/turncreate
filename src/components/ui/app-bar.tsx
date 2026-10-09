import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BackButton } from "./back-button";

/**
 * Header violeta fijo de las pantallas mobile (< lg; en desktop el shell
 * sigue usando el header-pill flotante que ya existía). Un solo
 * componente para las dos variantes que pedía el rediseño:
 *  - con `backHref`: fila ‹volver + título -- toda pantalla que no sea
 *    la home del tenant.
 *  - sin `backHref` (pasando `left` a mano): la home, con logo/nombre
 *    del local a la izquierda.
 * Siempre sticky + `pt-[var(--safe-t)]` para no quedar debajo del
 * notch/cámara cuando la PWA corre a pantalla completa (viewportFit:
 * "cover" en el layout raíz).
 */
export function AppBar({
  title,
  backHref,
  left,
  right,
  className,
}: {
  title?: string;
  backHref?: string;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-primary pt-[var(--safe-t)] lg:hidden",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        {backHref && <BackButton fallbackHref={backHref} variant="on-brand" />}
        {left}
        {title && (
          <h1 className="min-w-0 flex-1 truncate font-headline-sm text-headline-sm text-on-primary">
            {title}
          </h1>
        )}
        {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
      </div>
    </header>
  );
}
