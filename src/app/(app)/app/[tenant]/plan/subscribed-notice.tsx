"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Vuelta de Mercado Pago (?mp=subscribed). Es solo un "recibimos tu vuelta":
 * el estado real lo decide el servidor cuando MP avisa por webhook, nunca
 * este parámetro. Se saca de la URL al toque para que un refresh o un link
 * compartido no repita el "¡Listo!".
 */
export function SubscribedNotice() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("mp")) return;
    url.searchParams.delete("mp");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);
  if (!open) return null;
  return (
    <div role="status" className="flex min-w-0 items-start gap-3 rounded-inner bg-status-confirmed-bg py-2 pl-3 pr-1 text-status-confirmed">
      <Icon name="check_circle" className="mt-2.5 shrink-0 text-[18px]" />
      <div className="min-w-0 flex-1 py-2">
        <p className="font-label-lg text-label-lg">¡Listo! Mercado Pago está procesando tu suscripción…</p>
        <p className="font-body-sm text-body-sm text-on-surface">
          En unos minutos se actualiza el estado acá. Si pasa un rato largo y sigue igual, escribinos desde Ayuda.
        </p>
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar aviso" className="grid size-11 shrink-0 place-items-center rounded-full">
        <Icon name="close" className="text-[18px]" />
      </button>
    </div>
  );
}
