"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";

/**
 * Portal-based a propósito: si este modal se abre desde un botón que
 * vive dentro del header (que tiene backdrop-blur), un `position: fixed`
 * normal quedaría contenido por el header en vez del viewport -- filter/
 * backdrop-filter crean containing block para fixed/absolute. Renderizar
 * en document.body evita el problema de raíz en vez de parchearlo.
 */
export function Modal({
  open,
  onClose,
  children,
  title,
  variant = "center",
  maxWidth = "32rem",
  closeOnBack = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  variant?: "center" | "sheet";
  maxWidth?: string;
  /** El botón/gesto de "atrás" del celular cierra el modal en vez de dejar la pantalla. Default: true. */
  closeOnBack?: boolean;
}) {
  // `open` arranca en false y solo pasa a true por interacción del
  // usuario (después de hidratar) -- nunca hace falta un gate de
  // "montado" para evitar tocar `document` durante SSR.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Sin esto, el botón de atrás del teléfono (o el gesto de borde en
  // iOS) sale directo de la pantalla de atrás, abandonando el modal
  // abierto -- nunca lo cierra. Pusheamos una entrada de historial al
  // abrir; si el back la consume (popstate), cerramos el modal en vez de
  // dejar que el navegador siga para atrás. Si se cierra por otro medio
  // (click afuera, botón Cancelar), hay que sacar esa entrada nosotros
  // -- si no, el PRÓXIMO back del usuario "no hace nada" porque cae en
  // una entrada fantasma que ya no corresponde a ningún estado visible.
  useEffect(() => {
    if (!open || !closeOnBack) return;
    let closedByBack = false;
    history.pushState({ turncreateModal: true }, "");
    const handlePopState = () => {
      closedByBack = true;
      onClose();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByBack && (history.state as { turncreateModal?: boolean } | null)?.turncreateModal) {
        history.back();
      }
    };
  }, [open, closeOnBack, onClose]);

  if (!open) return null;

  // El sheet queda anclado abajo con su propio scroll interno, sin
  // problema. El centrado sí lo tenía: con el teclado del celular
  // abierto, 100vh/fixed no se achica, y centrar contenido más alto que
  // el área visible real dejaba la mitad de arriba inalcanzable -- por
  // eso acá el scroll vive en el contenedor de afuera, no en la tarjeta.
  if (variant === "sheet") {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-end justify-center">
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 animate-scrim-in bg-on-surface/40 backdrop-blur-sm"
        />
        <div className="relative z-10 max-h-[85vh] w-full animate-sheet-up overflow-y-auto rounded-t-[28px] border border-border bg-surface-container-lowest/90 p-lg shadow-card-hover backdrop-blur-xl [padding-bottom:calc(2rem+var(--safe-b))]">
          <div className="mx-auto mb-md h-1.5 w-10 rounded-full bg-border" />
          {title && (
            <div className="mb-md flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container"
                aria-label="Cerrar"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      role="button"
      aria-label="Cerrar"
      onClick={onClose}
      className="fixed inset-0 z-[100] overflow-y-auto bg-on-surface/40 backdrop-blur-sm"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative my-6 w-full animate-pop-in rounded-card border border-border bg-surface-container-lowest/85 p-lg shadow-card-hover backdrop-blur-xl sm:my-0"
          style={{ maxWidth }}
        >
          {title && (
            <div className="mb-md flex items-center justify-between">
              <span className="font-headline-sm text-headline-sm text-on-surface">{title}</span>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container"
                aria-label="Cerrar"
              >
                <Icon name="close" className="text-[18px]" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
