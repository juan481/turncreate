"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Step = { selector: string; icon: string; title: string; body: string };

const STEPS: Step[] = [
  {
    selector: '[data-tour="tenant-switcher"]',
    icon: "storefront",
    title: "Este demo tiene 3 locales",
    body: "Acá arriba elegís con cuál trabajar. \"OSSADA Express\" y \"Barbería Dandy\" tienen un solo profesional (agenda en lista); \"OSSADA Beauty Studio\" tiene tres (agenda en grilla). Cambiá de uno a otro cuando quieras para comparar.",
  },
  {
    selector: '[data-tour="inicio"]',
    icon: "home",
    title: "Inicio",
    body: "Resumen del día: ingresos, el próximo turno, el resto de la agenda de hoy, quién atendió más y cómo pagaron los clientes.",
  },
  {
    selector: '[data-tour="agenda"]',
    icon: "calendar_month",
    title: "Agenda",
    body: "Vista día, semana o mes. En un local con un solo profesional se ve como lista; con varios, en grilla con una columna por persona, y podés arrastrar un turno para reprogramarlo.",
  },
  {
    selector: '[data-tour="clientes"]',
    icon: "group",
    title: "Clientes",
    body: "Historial de turnos, notas y datos de contacto de cada persona que se atendió.",
  },
  {
    selector: '[data-tour="servicios"]',
    icon: "content_cut",
    title: "Servicios",
    body: "El catálogo del local: nombre, precio y duración de cada servicio.",
  },
  {
    selector: '[data-tour="staff"]',
    icon: "badge",
    title: "Staff",
    body: "Solo aparece si hay más de un profesional. Altas, horario de cada uno, qué servicios atiende, foto y comisión.",
  },
  {
    selector: '[data-tour="caja"]',
    icon: "point_of_sale",
    title: "Caja",
    body: "Abrir y cerrar caja, cobrar turnos (efectivo, posnet, transferencia) y registrar movimientos sueltos. Al cerrar se compara lo contado contra lo esperado.",
  },
];

const PAD = 10;

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Sus únicos objetivos (`data-tour="..."`) viven en NavPills y
 * TenantSwitcher, que están ocultos por debajo de 1280px (xl) -- por
 * eso en mobile/tablet SIEMPRE caía en el overlay de pantalla completa
 * ("sin target"), que tapaba el header/bottom-nav/modales enteros y
 * dejaba los botones Saltar/Atrás/Siguiente apretados o fuera de
 * pantalla. Correrlo solo en pantallas anchas evita el problema de
 * raíz en vez de intentar parchear un tooltip de escritorio para caber
 * en 360px.
 */
const WIDE_QUERY = "(min-width: 1280px)";

export function DemoTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() => searchParams.get("demoTutorial") === "1");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(false);
  const [isWide, setIsWide] = useState(false);

  // Gate de montado: createPortal(..., document.body) no puede correr en
  // el servidor (document no existe ahí), así que el portal recién se
  // habilita una vez hidratado en el cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con una media query externa, no con props/estado de React
    setIsWide(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (searchParams.get("demoTutorial") !== "1") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("demoTutorial");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr una vez, al montar
  }, []);

  const step = STEPS[stepIndex];

  const measure = useCallback(() => {
    if (!step) return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const el = document.querySelector<HTMLElement>(step.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setRect(r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    });
  }, [step]);

  useEffect(() => {
    if (!active) return;
    // Mide la posición real del elemento resaltado en el DOM -- es
    // justamente sincronizar React con un sistema externo (el layout).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    measure();
    const timeout = setTimeout(measure, 350); // tras el scrollIntoView suave
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", measure);
    };
  }, [active, measure]);

  if (!mounted || !active || !step || !isWide) return null;

  const isLast = stepIndex === STEPS.length - 1;
  const hasTarget = rect !== null && viewport.width > 0;

  const highlightStyle: React.CSSProperties = hasTarget
    ? {
        position: "fixed",
        top: rect!.top - PAD,
        left: rect!.left - PAD,
        width: rect!.width + PAD * 2,
        height: rect!.height + PAD * 2,
        borderRadius: 16,
        boxShadow: "0 0 0 9999px rgba(10, 8, 20, 0.78)",
        transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        pointerEvents: "none",
        zIndex: 300,
      }
    : { position: "fixed", inset: 0, background: "rgba(10, 8, 20, 0.78)", zIndex: 300 };

  // Sin target: se centra con un wrapper flex (inset:0 + items/justify
  // center), no con `transform: translate(-50%,-50%)` -- un elemento con
  // `animate-pop-in` (animación CSS que también anima `transform`, con
  // fill-mode "both") hace que el navegador descarte cualquier otro
  // valor de `transform` mientras la animación esté activa/aplicada, así
  // que ese translate de centrado se perdía y el tooltip quedaba con su
  // esquina superior izquierda (no su centro) en el medio de la pantalla.
  let tooltipStyle: React.CSSProperties = { position: "fixed", zIndex: 301 };
  if (hasTarget) {
    const tooltipWidth = Math.min(360, viewport.width - 32);
    const spaceBelow = viewport.height - (rect!.top + rect!.height + PAD);
    const top = spaceBelow > 220 ? rect!.top + rect!.height + PAD + 16 : Math.max(16, rect!.top - PAD - 16 - 220);
    const left = Math.min(Math.max(16, rect!.left), viewport.width - tooltipWidth - 16);
    tooltipStyle = { position: "fixed", top, left, width: tooltipWidth, zIndex: 301 };
  }

  function goTo(index: number) {
    setRect(null);
    setStepIndex(index);
  }

  const tooltip = (
    <div
      style={hasTarget ? tooltipStyle : undefined}
      className={cn(
        "animate-pop-in space-y-md rounded-card border border-border bg-surface-container-lowest p-lg shadow-card-hover",
        !hasTarget && "w-full max-w-[22.5rem]",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
          <Icon name={step.icon} className="text-[18px]" />
        </div>
        <div className="min-w-0">
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            Paso {stepIndex + 1} de {STEPS.length}
          </p>
          <p className="font-headline-sm text-headline-sm text-on-surface">{step.title}</p>
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">{step.body}</p>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setActive(false)}
          className="font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Saltar
        </button>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button type="button" variant="secondary" size="sm" onClick={() => goTo(stepIndex - 1)}>
              Atrás
            </Button>
          )}
          <Button type="button" size="sm" onClick={() => (isLast ? setActive(false) : goTo(stepIndex + 1))}>
            {isLast ? "Entendido, empezar" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div style={highlightStyle} />
      {hasTarget ? tooltip : (
        <div style={{ zIndex: 301 }} className="fixed inset-0 flex items-center justify-center p-4">
          {tooltip}
        </div>
      )}
    </>,
    document.body,
  );
}
