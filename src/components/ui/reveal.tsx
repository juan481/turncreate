"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fade-in al entrar en viewport, vía IntersectionObserver. Solo se
 * anima una vez (no se re-oculta al salir de pantalla) para no marear
 * scrolleando arriba y abajo.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // Algunas secciones de marketing son más altas que el viewport. Con
      // threshold 0.15 nunca llegaban a tener 15% visible en mobile y
      // quedaban transparentes para siempre. Cualquier intersección real es
      // suficiente para iniciar la entrada.
      { threshold: 0.01, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out", visible ? "opacity-100" : "translate-y-6 opacity-0", className)}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
