import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { DayPart } from "./greeting";

// Ícono teñido según la franja: sol ámbar, atardecer violeta, luna sobre
// el violeta profundo. Todo por token, nada de hex.
const ICON_TONE: Record<DayPart, string> = {
  morning: "bg-status-draft-bg text-status-draft-dot",
  afternoon: "bg-secondary-soft text-primary",
  night: "bg-primary-deep text-primary-glow",
};

/**
 * Saludo de la home. Animación de entrada sutil SOLO con `motion-safe:`
 * (con prefers-reduced-motion aparece directo, sin movimiento).
 */
export function HomeGreeting({
  dayPart,
  icon,
  title,
  subtitle,
  dateLabel,
}: {
  dayPart: DayPart;
  icon: string;
  title: string;
  subtitle: string;
  dateLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 motion-safe:animate-greet-in">
      <span
        aria-hidden
        className={cn("grid size-12 shrink-0 place-items-center rounded-full text-[24px] shadow-card motion-safe:animate-icon-rise", ICON_TONE[dayPart])}
        style={{ animationDelay: "120ms" }}
      >
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">{title}</h1>
        <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
        <p className="mt-0.5 font-label-sm text-label-sm first-letter:uppercase text-on-surface-variant/80">{dateLabel}</p>
      </div>
    </div>
  );
}
