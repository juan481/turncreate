"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { MpResult } from "./mp-result";

const MESSAGES: Record<MpResult, { tone: "ok" | "warning" | "alert"; title: string; body: string }> = {
  connected: { tone: "ok", title: "¡Listo! Tu cuenta de Mercado Pago quedó conectada", body: "Ya podés cobrar las señas online. Revisá abajo quién paga la comisión." },
  denied: { tone: "warning", title: "No se conectó Mercado Pago", body: "No autorizaste la conexión en Mercado Pago. Podés volver a intentarlo cuando quieras." },
  expired: { tone: "warning", title: "Se venció el pedido de conexión", body: "Pasaron más de 10 minutos. Tocá \"Conectar Mercado Pago\" de nuevo." },
  error: { tone: "alert", title: "No pudimos conectar Mercado Pago", body: "Mercado Pago no completó la conexión. Probá de nuevo en unos minutos." },
  unavailable: { tone: "alert", title: "La conexión con Mercado Pago no está disponible", body: "Estamos con un problema de nuestro lado. Probá más tarde o escribinos desde Ayuda." },
};

const TONE = {
  ok: { box: "bg-status-confirmed-bg text-status-confirmed", icon: "check_circle" },
  warning: { box: "bg-status-draft-bg text-status-draft", icon: "info" },
  alert: { box: "bg-status-alert-bg text-status-alert", icon: "warning" },
} as const;

/**
 * Resultado de la vuelta de Mercado Pago (?mp=...). El banner queda hasta
 * que lo cierren, pero el parámetro se saca de la URL al toque (history
 * nativo, integrado al router de Next): así un refresh o un "compartir
 * link" no vuelve a mostrar "¡Listo!".
 */
export function MpResultNotice({ result }: { result: MpResult }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("mp")) return;
    url.searchParams.delete("mp");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  if (!open) return null;
  const message = MESSAGES[result];
  const tone = TONE[message.tone];
  return (
    <div role={message.tone === "ok" ? "status" : "alert"} className={cn("flex min-w-0 items-start gap-3 rounded-inner py-2 pl-3 pr-1", tone.box)}>
      <Icon name={tone.icon} className="mt-2.5 shrink-0 text-[18px]" />
      <div className="min-w-0 flex-1 py-2">
        <p className="font-label-lg text-label-lg">{message.title}</p>
        <p className="font-body-sm text-body-sm text-on-surface">{message.body}</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso" className="grid size-11 shrink-0 place-items-center rounded-full">
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
