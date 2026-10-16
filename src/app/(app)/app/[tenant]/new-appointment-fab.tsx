"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const LAUNCH_MS = 230;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const STAGGER_MS = 50;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type QuickAction = { href: string; label: string; icon: string; primary?: boolean };

/**
 * Las acciones del +, en el orden en que se apilan de ARRIBA hacia abajo:
 * la última ("Nuevo turno", la más usada) queda pegada al botón.
 * "Nuevo cliente" va a /clientes?nuevo=1: el alta es un formulario
 * desplegable dentro de esa pantalla, que se abre solo con ese parámetro.
 */
export function quickActions(base: string, newAppointmentHref: string): QuickAction[] {
  return [
    { href: `${base}/caja`, label: "Cobrar", icon: "point_of_sale" },
    { href: `${base}/clientes?nuevo=1`, label: "Nuevo cliente", icon: "person_add" },
    { href: newAppointmentHref, label: "Nuevo turno", icon: "event", primary: true },
  ];
}

/**
 * Estado abierto/cerrado del speed-dial. Se guarda el pathname en el que
 * se abrió en vez de un booleano: si la ruta cambia (tocaste una acción,
 * o el atrás del navegador), `open` pasa a false solo, sin un efecto que
 * haga setState. Escape cierra y devuelve el foco al + (`toggleRef`, que
 * se pasa aparte: devolver un ref adentro del objeto hace que el linter
 * del React Compiler trate TODO el objeto como ref y prohíba leer `open`).
 */
export function useSpeedDial(toggleRef: RefObject<HTMLButtonElement | null>) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenPath(null);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, toggleRef]);

  return {
    open,
    setOpen: (next: boolean) => setOpenPath(next ? pathname : null),
    toggle: () => setOpenPath((current) => (current === pathname ? null : pathname)),
  };
}

/**
 * Rebote del + al abrir (aprieta, rebota, suelta una onda). Web Animations
 * API: corre una vez por toque sin andar poniendo/sacando clases. El giro
 * + → × lo hace CSS (rotate-45), no esto.
 */
function useLaunchAnimation() {
  const bubbleRef = useRef<HTMLSpanElement>(null);
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
    rippleRef.current?.animate(
      [
        { transform: "scale(1)", opacity: 0.55 },
        { transform: "scale(1.85)", opacity: 0 },
      ],
      { duration: LAUNCH_MS, easing: "ease-out" },
    );
  }

  return { bubbleRef, rippleRef, launch };
}

/**
 * Velo oscuro + acciones apiladas, en un portal a document.body: la barra
 * inferior tiene backdrop-blur, y eso la vuelve containing block de
 * cualquier `fixed` de adentro (el velo quedaría del tamaño de la barra).
 * z-[60]: tapa AppBar (z-40) y barra (z-50); el botón que lo abre se
 * sube a z-[70] mientras está abierto para quedar nítido encima.
 */
function SpeedDialMenu({
  id,
  open,
  onClose,
  actions,
  placement,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  actions: QuickAction[];
  placement: "bottom-nav" | "fab";
}) {
  const pathname = usePathname();
  const lastRef = useRef<HTMLAnchorElement>(null);

  // Foco a la acción más cercana al botón (la principal) al abrir.
  useEffect(() => {
    if (open) lastRef.current?.focus({ preventScroll: true });
  }, [open]);

  if (!open) return null;

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Cerrar acciones rápidas"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-[60] animate-scrim-in bg-scrim/60 backdrop-blur-sm motion-reduce:animate-none"
      />
      <div
        id={id}
        role="group"
        aria-label="Acciones rápidas"
        className={cn(
          "fixed z-[61] flex flex-col gap-2.5",
          placement === "bottom-nav"
            ? "inset-x-0 bottom-[calc(6.25rem+var(--safe-b))] items-center px-gutter lg:hidden"
            : "bottom-[6.5rem] right-8 hidden items-end lg:flex",
        )}
      >
        {actions.map((action, index) => (
          <Link
            key={action.label}
            ref={index === actions.length - 1 ? lastRef : undefined}
            href={action.href}
            onClick={(event) => {
              // Mismo pathname (ej. ya estás en Caja y tocás "Cobrar"): la
              // ruta no cambia, así que el cierre automático no corre.
              if (action.href.split("?")[0] === pathname) event.preventDefault();
              onClose();
            }}
            style={{ animationDelay: `${(actions.length - 1 - index) * STAGGER_MS}ms` }}
            className="flex h-12 min-w-0 max-w-full animate-dial-in items-center gap-3 rounded-pill bg-surface-container-lowest pl-1.5 pr-5 shadow-card-hover outline-none transition-transform focus-visible:ring-4 focus-visible:ring-primary/40 motion-reduce:animate-none motion-safe:active:scale-95"
          >
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full text-[18px]",
                action.primary ? "bg-primary text-on-primary" : "bg-secondary-soft text-secondary",
              )}
            >
              <Icon name={action.icon} />
            </span>
            <span className="truncate font-label-lg text-label-lg text-on-surface">{action.label}</span>
          </Link>
        ))}
      </div>
    </>,
    document.body,
  );
}

/** El + central de la barra inferior (mobile). El estado lo maneja MobileBottomNav. */
export function QuickActionsNavButton({
  base,
  newAppointmentHref,
  dial,
  toggleRef,
}: {
  base: string;
  newAppointmentHref: string;
  dial: ReturnType<typeof useSpeedDial>;
  toggleRef: RefObject<HTMLButtonElement | null>;
}) {
  const { bubbleRef, rippleRef, launch } = useLaunchAnimation();
  const menuId = useId();
  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-label={dial.open ? "Cerrar acciones rápidas" : "Nuevo: turno, cliente o cobro"}
        aria-expanded={dial.open}
        aria-controls={menuId}
        onClick={() => {
          if (!dial.open) launch();
          dial.toggle();
        }}
        className="group relative z-10 flex min-h-14 min-w-0 flex-1 flex-col items-center justify-end gap-1 pb-2 outline-none"
      >
        <span className="absolute -top-6 grid size-14 place-items-center">
          <span ref={rippleRef} aria-hidden className="absolute inset-0 rounded-full bg-primary opacity-0" />
          <span
            ref={bubbleRef}
            className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary-light via-primary to-primary-deep text-on-primary shadow-fab ring-[5px] ring-surface-container-lowest transition-transform duration-100 group-focus-visible:ring-primary/40 motion-safe:group-active:scale-[0.92]"
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-2 top-1 h-4 rounded-full bg-white/25 blur-[3px]" />
            <span
              className={cn(
                "relative grid place-items-center transition-transform duration-200 ease-out motion-reduce:transition-none",
                dial.open && "rotate-45",
              )}
            >
              <Icon name="add" className="text-[28px]" />
            </span>
          </span>
        </span>
        <span className={cn("font-label-xs text-label-xs", dial.open ? "text-on-primary" : "text-on-surface-variant")}>
          {dial.open ? "Cerrar" : "Nuevo"}
        </span>
      </button>
      <SpeedDialMenu
        id={menuId}
        open={dial.open}
        onClose={() => dial.setOpen(false)}
        actions={quickActions(base, newAppointmentHref)}
        placement="bottom-nav"
      />
    </>
  );
}

/** Solo desktop/tablet (lg+): mismo speed-dial, abajo a la derecha. */
export function NewAppointmentFab({ tenantSlug }: { tenantSlug: string }) {
  const base = `/app/${tenantSlug}`;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dial = useSpeedDial(toggleRef);
  const { bubbleRef, rippleRef, launch } = useLaunchAnimation();
  const menuId = useId();
  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        onClick={() => {
          if (!dial.open) launch();
          dial.toggle();
        }}
        className={cn("group fixed bottom-8 right-8 hidden size-14 outline-none lg:grid", dial.open ? "z-[70]" : "z-40")}
        aria-label={dial.open ? "Cerrar acciones rápidas" : "Nuevo: turno, cliente o cobro"}
        aria-expanded={dial.open}
        aria-controls={menuId}
        title="Nuevo"
      >
        <span ref={rippleRef} aria-hidden className="absolute inset-0 rounded-full bg-primary opacity-0" />
        <span
          ref={bubbleRef}
          className="relative grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary-light via-primary to-primary-deep text-on-primary shadow-card-hover transition-transform duration-200 group-hover:-translate-y-0.5 group-focus-visible:ring-4 group-focus-visible:ring-primary/40 motion-safe:group-active:scale-95"
        >
          <span
            className={cn(
              "grid place-items-center transition-transform duration-200 ease-out motion-reduce:transition-none",
              dial.open && "rotate-45",
            )}
          >
            <Icon name="add" className="text-[26px]" />
          </span>
        </span>
      </button>
      <SpeedDialMenu
        id={menuId}
        open={dial.open}
        onClose={() => dial.setOpen(false)}
        actions={quickActions(base, `${base}/agenda/nuevo`)}
        placement="fab"
      />
    </>
  );
}
