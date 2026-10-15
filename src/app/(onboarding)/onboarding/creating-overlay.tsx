"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";

// El wizard lo precarga apenas monta (ver wizard.tsx): si se pide recién al
// mostrar esta pantalla, el ícono llega tarde y se ve el cuadrado vacío.
export const JUST_CREATE_ICON = "/brand/just-create-icon.png";

const MESSAGES = [
  "Armando tu agenda…",
  "Cargando tus horarios…",
  "Preparando tu link público…",
  "Dejando todo listo para tus clientas…",
];

export function CreatingOverlay({ done }: { done: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % MESSAGES.length), 1400);
    return () => clearInterval(timer);
  }, [done]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[200] flex animate-fade-in flex-col items-center justify-center overflow-hidden bg-[#121217] px-6 text-center"
    >
      <span aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 animate-float-slow rounded-full bg-primary/40 blur-3xl motion-reduce:animate-none" />
      <span aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 animate-float-slow-delayed rounded-full bg-[#4ade80]/20 blur-3xl motion-reduce:animate-none" />

      <div className="relative grid h-44 w-44 place-items-center">
        <svg viewBox="0 0 176 176" className="absolute inset-0 animate-spin-slow motion-reduce:animate-none" aria-hidden>
          <circle cx="88" cy="88" r="82" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle cx="88" cy="88" r="82" fill="none" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" strokeDasharray="120 400" />
        </svg>
        <svg viewBox="0 0 176 176" className="absolute inset-0 animate-spin-reverse motion-reduce:animate-none" aria-hidden>
          <circle cx="88" cy="88" r="68" fill="none" stroke="#857df2" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 12" />
        </svg>
        <div className="relative animate-breathe motion-reduce:animate-none">
          {done ? (
            <span className="grid h-20 w-20 animate-pop-in place-items-center rounded-[22px] bg-[#4ade80] text-[#121217] shadow-[0_10px_40px_-8px_rgba(74,222,128,0.7)]">
              <Icon name="check" className="text-[40px]" />
            </span>
          ) : (
            <Image
              src={JUST_CREATE_ICON}
              alt="Just Create"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 rounded-[22px] shadow-[0_10px_40px_-8px_rgba(112,105,232,0.8)]"
            />
          )}
        </div>
      </div>

      <h2 className="mt-8 font-headline-lg-mobile text-headline-lg-mobile text-white">
        {done ? "¡Tu turnero está listo!" : "Estamos creando tu turnero"}
      </h2>
      <p key={done ? "done" : index} className="mt-2 min-h-6 animate-fade-up font-body-md text-body-md text-white/70">
        {done ? "Te llevamos a tu panel…" : MESSAGES[index]}
      </p>

      <p className="absolute inset-x-0 bottom-[calc(1.5rem+var(--safe-b))] font-label-sm text-label-sm tracking-wide text-white/40">
        TurnCreate · by Just Create
      </p>
    </div>
  );
}
