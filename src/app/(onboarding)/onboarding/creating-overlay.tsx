"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { byGender, type Gender } from "@/lib/gender";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "Estamos creando tu turnero…",
  "Cargando tus horarios…",
  "Preparando tu agenda…",
  "Dejando todo listo para tus clientas…",
];

const MESSAGE_MS = 1400;

/**
 * Pantalla de "creando tu local" con la identidad de TurnCreate. Va montada
 * FUERA de cualquier ancestro con transform (ver wizard.tsx): si no, el
 * `fixed inset-0` se acomoda a ese ancestro y no a la pantalla.
 */
export function CreatingOverlay({ done, gender, firstName }: { done: boolean; gender: Gender | null; firstName: string }) {
  const [index, setIndex] = useState(0);
  // Arranca en un poquito y en el frame siguiente avanza: si montara directo
  // en el ancho final, la transición de la barra no tendría desde dónde correr.
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % MESSAGES.length), MESSAGE_MS);
    return () => clearInterval(timer);
  }, [done]);

  const name = firstName.trim();
  const welcome = byGender(gender, {
    female: name ? `¡Bienvenida, ${name}!` : "¡Bienvenida!",
    male: name ? `¡Bienvenido, ${name}!` : "¡Bienvenido!",
    neutral: name ? `¡Te damos la bienvenida, ${name}!` : "¡Te damos la bienvenida!",
  });

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={!done}
      className="fixed inset-0 z-[200] flex animate-fade-in flex-col items-center justify-center overflow-hidden bg-canvas px-6 pb-[calc(4rem+var(--safe-b))] pt-[calc(2rem+var(--safe-t))] text-center"
    >
      {/* Fondo con vida: blobs violetas difusos, quietos si se pidió menos movimiento. */}
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 animate-float-slow rounded-full bg-primary/25 blur-3xl motion-reduce:animate-none" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 animate-float-slow-delayed rounded-full bg-secondary/20 blur-3xl motion-reduce:animate-none" />

      <div className="relative grid h-44 w-44 shrink-0 place-items-center">
        {/* Ondas que laten hacia afuera. */}
        {!done && (
          <>
            <span aria-hidden className="absolute inset-6 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s] motion-reduce:hidden" />
            <span aria-hidden className="absolute inset-10 animate-ping rounded-full bg-primary/10 [animation-delay:1.2s] [animation-duration:2.4s] motion-reduce:hidden" />
          </>
        )}
        <svg viewBox="0 0 176 176" className="absolute inset-0 animate-spin-slow text-primary motion-reduce:animate-none" aria-hidden>
          <circle cx="88" cy="88" r="82" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="4" />
          <circle
            cx="88"
            cy="88"
            r="82"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            // Al terminar, el arco se completa en un anillo entero.
            style={{ strokeDasharray: done ? "516 0" : "120 400" }}
            className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
          />
        </svg>
        <svg viewBox="0 0 176 176" className={cn("absolute inset-0 text-primary/50", !done && "animate-spin-reverse motion-reduce:animate-none")} aria-hidden>
          <circle cx="88" cy="88" r="68" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 12" />
        </svg>

        <div className="relative animate-breathe motion-reduce:animate-none">
          {done ? (
            <span className="grid h-20 w-20 animate-pop-in place-items-center rounded-[22px] bg-primary text-on-primary shadow-card-hover motion-reduce:animate-none">
              <Icon name="check" className="text-[40px]" />
            </span>
          ) : (
            <Logo iconOnly className="h-24 w-24 drop-shadow-[0_10px_24px_rgb(112_105_232/0.45)]" />
          )}
        </div>
      </div>

      <h2 className="mt-8 max-w-[22rem] font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        {done ? "¡Tu turnero está listo!" : welcome}
      </h2>
      <p
        key={done ? "done" : index}
        className="mt-2 min-h-6 max-w-[22rem] animate-fade-up font-body-md text-body-md text-on-surface-variant motion-reduce:animate-none"
      >
        {done ? "Te llevamos a tu panel…" : MESSAGES[index]}
      </p>

      {/* Barra de progreso indeterminada: se llena del todo al terminar. */}
      <div aria-hidden className="mt-6 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-pill bg-surface-container-high">
        <div
          className={cn(
            "h-full rounded-pill bg-primary transition-[width] ease-out motion-reduce:transition-none",
            done ? "duration-500" : "duration-[2200ms]",
          )}
          style={{ width: done ? "100%" : started ? "85%" : "8%" }}
        />
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-[calc(1.5rem+var(--safe-b))] flex flex-col items-center gap-1">
        <Logo className="h-6 w-auto opacity-80" />
        <span className="font-label-sm text-label-sm tracking-wide text-on-surface-variant">by Just Create</span>
      </div>
    </div>
  );
}
