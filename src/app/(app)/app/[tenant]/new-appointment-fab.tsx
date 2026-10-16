"use client";

import { useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const LAUNCH_MS = 230;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * "Lanzamiento" del +: aprieta, rebota, gira el ícono y suelta una onda.
 * Web Animations API en vez de keyframes en globals.css: corre una vez por
 * toque y no hay que andar sacando/poniendo clases para re-dispararla. No
 * frena la navegación: la barra vive en el layout, así que sigue animando
 * mientras carga la pantalla de nuevo turno.
 */
function useLaunchAnimation() {
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);

  function launch() {
    if (prefersReducedMotion()) return;
    bubbleRef.current?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(1px) scale(0.86)", offset: 0.28 },
        { transform: "translateY(-3px) scale(1.1)", offset: 0.65 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: LAUNCH_MS, easing: EASE_OUT },
    );
    iconRef.current?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(90deg)" }], { duration: LAUNCH_MS, easing: EASE_OUT });
    rippleRef.current?.animate(
      [
        { transform: "scale(1)", opacity: 0.55 },
        { transform: "scale(1.85)", opacity: 0 },
      ],
      { duration: LAUNCH_MS, easing: "ease-out" },
    );
  }

  return { bubbleRef, iconRef, rippleRef, launch };
}

/** El + central de la barra inferior (mobile). */
export function NewAppointmentNavButton({ href }: { href: string }) {
  const { bubbleRef, iconRef, rippleRef, launch } = useLaunchAnimation();
  return (
    <Link
      href={href}
      aria-label="Nuevo turno"
      onClick={launch}
      className="group relative flex h-full min-w-0 flex-col items-center justify-end gap-1 pb-1.5 outline-none"
    >
      <span className="absolute -top-6 grid size-14 place-items-center">
        <span ref={rippleRef} aria-hidden className="absolute inset-0 rounded-full bg-primary opacity-0" />
        <span
          ref={bubbleRef}
          className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#8f88f5] via-primary to-[#4c43c4] text-on-primary shadow-[0_10px_22px_-8px_rgba(76,67,196,0.8)] ring-[5px] ring-surface-container-lowest transition-transform duration-100 group-focus-visible:ring-primary/40 motion-safe:group-active:scale-[0.92]"
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1 h-4 rounded-full bg-white/25 blur-[3px]" />
          <span ref={iconRef} className="relative grid place-items-center">
            <Icon name="add" className="text-[28px]" />
          </span>
        </span>
      </span>
      <span className="font-label-xs text-label-xs text-on-surface-variant">Nuevo</span>
    </Link>
  );
}

/**
 * Solo desktop/tablet (lg+): en mobile el + central de MobileBottomNav ya
 * cubre "nuevo turno" en cualquier pantalla.
 */
export function NewAppointmentFab({ tenantSlug }: { tenantSlug: string }) {
  const { bubbleRef, iconRef, rippleRef, launch } = useLaunchAnimation();
  return (
    <Link
      href={`/app/${tenantSlug}/agenda/nuevo`}
      onClick={launch}
      className="group fixed bottom-8 right-8 z-40 hidden size-14 lg:grid"
      aria-label="Nuevo turno"
      title="Nuevo turno"
    >
      <span ref={rippleRef} aria-hidden className="absolute inset-0 rounded-full bg-primary opacity-0" />
      <span
        ref={bubbleRef}
        className={cn(
          "relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-[#8f88f5] via-primary to-[#4c43c4] text-on-primary shadow-card-hover transition-transform duration-200",
          "group-hover:-translate-y-0.5 motion-safe:group-active:scale-95",
        )}
      >
        <span ref={iconRef} className="grid place-items-center">
          <Icon name="add" className="text-[26px]" />
        </span>
      </span>
    </Link>
  );
}
