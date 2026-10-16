import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MENU_TILE_CLASS, MENU_TILE_ICON_CLASS } from "@/components/ui/menu-tile";
import { cn } from "@/lib/utils";

// Piezas de presentación compartidas por el hub de Configuración y sus
// sub-pantallas. Sin "use client": se renderizan en el servidor.

/** Encabezado de escritorio (en mobile el título ya lo pone el AppBar). */
export function ScreenIntro({ title, description }: { title: string; description: string }) {
  return (
    <>
      <div className="hidden lg:block">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant lg:hidden">{description}</p>
    </>
  );
}

export function SettingsSection({
  icon,
  title,
  description,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  /** Algo chico a la derecha del título (ej. un StatusPill). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card hoverLift={false} className="min-w-0 space-y-md p-lg sm:p-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-[20px] text-secondary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          {description && <p className="font-body-md text-body-md text-on-surface-variant">{description}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </Card>
  );
}

export type HubTileTone = "neutral" | "ok" | "warning";

const TONE_CLASS: Record<HubTileTone, string> = {
  neutral: "text-on-surface-variant",
  ok: "text-status-confirmed",
  warning: "text-status-draft",
};

/**
 * Botón grande del hub. Mismo molde visual que MenuTile (borde, radio,
 * ícono en cuadrado violeta) pero siempre en fila y con chevron, porque acá
 * la línea de estado ("Mercado Pago conectado") es tan importante como el
 * título y en dos columnas a 320px no entraba. `locked` muestra la opción
 * deshabilitada con candado en vez de esconderla (ej. Equipo en plan Solo).
 */
export function HubTile({
  href,
  icon,
  title,
  status,
  tone = "neutral",
  locked = false,
}: {
  href: string;
  icon: string;
  title: string;
  status?: string;
  tone?: HubTileTone;
  locked?: boolean;
}) {
  const content = (
    <>
      <span className={cn(MENU_TILE_ICON_CLASS, locked && "bg-surface-container text-on-surface-variant")}>
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-label-lg text-label-lg leading-tight", locked ? "text-on-surface-variant" : "text-on-surface")}>{title}</p>
        {status && <p className={cn("mt-0.5 line-clamp-2 font-body-sm text-body-sm", locked ? "text-on-surface-variant" : TONE_CLASS[tone])}>{status}</p>}
      </div>
      <Icon name={locked ? "lock" : "chevron_right"} className="shrink-0 text-[18px] text-on-surface-variant" />
    </>
  );
  const className = cn(MENU_TILE_CLASS, "min-h-[4.5rem] flex-row items-center gap-3 sm:gap-3");
  if (locked) {
    return (
      <div aria-disabled="true" className={cn(className, "cursor-not-allowed bg-surface-container-low active:bg-surface-container-low")}>
        {content}
      </div>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  );
}

/** Fila de requisito con tilde/alerta y link opcional para resolverlo. */
export function RequirementRow({ done, label, hint, href, actionLabel }: { done: boolean; label: string; hint?: string; href?: string; actionLabel?: string }) {
  return (
    <li className="flex min-w-0 items-start gap-3 rounded-inner bg-surface-container-low px-3 py-2.5">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-[14px]",
          done ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-draft-bg text-status-draft",
        )}
      >
        <Icon name={done ? "check" : "priority_high"} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-label-lg text-label-lg text-on-surface">{label}</p>
        {hint && <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
      </div>
      {!done && href && (
        <Link href={href} className="-my-1.5 inline-flex min-h-11 shrink-0 items-center gap-0.5 font-label-md text-label-md text-secondary">
          {actionLabel ?? "Configurar"}
          <Icon name="chevron_right" className="text-[16px]" />
        </Link>
      )}
    </li>
  );
}
