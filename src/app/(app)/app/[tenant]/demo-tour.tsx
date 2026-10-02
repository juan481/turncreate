"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

type Step = { selector: string; icon: string; title: string; body: string };

const STEPS: Step[] = [
  {
    selector: '[data-tour="tenant-switcher"]',
    icon: "storefront",
    title: "Este demo tiene 2 locales",
    body: "Acá arriba elegís con cuál trabajar. \"Estética Demo Solo\" tiene un solo profesional; \"Estudio Demo Equipo\" tiene tres. Cambiá de uno a otro cuando quieras para comparar las dos vistas.",
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

export function DemoTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(() => searchParams.get("demoTutorial") === "1");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [mounted, setMounted] = useState(false);

  // Gate de montado: createPortal(..., document.body) no puede correr en
  // el servidor (document no existe ahí), así que el portal recién se
  // habilita una vez hidratado en el cliente.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

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

  if (!mounted || !active || !step) return null;

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

  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 301,
  };
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

  return createPortal(
    <>
      <div style={highlightStyle} />
      <div
        style={tooltipStyle}
        className="animate-pop-in space-y-md rounded-card border border-border bg-surface-container-lowest p-lg shadow-card-hover"
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
    </>,
    document.body,
  );
}
