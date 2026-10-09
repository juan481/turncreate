"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { show: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

/** Ej: toast.show("Turno agendado para el sábado 10/10 10:00") tras crear un turno. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() necesita un <ToastProvider> en un ancestro (ya está puesto en el layout del tenant).");
  return ctx;
}

const TONE_ICON: Record<ToastTone, string> = { success: "check_circle", error: "warning", info: "info" };
const TONE_COLOR: Record<ToastTone, string> = {
  success: "text-status-confirmed",
  error: "text-status-alert",
  info: "text-secondary",
};

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Por encima de la barra inferior (~5.5rem con safe-area) en
          mobile; en desktop, donde no hay barra inferior, pegado abajo. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+var(--safe-b))] z-[300] flex flex-col items-center gap-2 px-gutter lg:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-[24rem] items-center gap-2 rounded-pill border border-border bg-surface-container-lowest/95 px-4 py-2.5 shadow-card-hover backdrop-blur-xl animate-fade-up"
          >
            <Icon name={TONE_ICON[t.tone]} className={cn("text-[18px]", TONE_COLOR[t.tone])} />
            <span className="font-label-md text-label-md text-on-surface">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
