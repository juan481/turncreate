"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cancelAppointmentAction } from "./actions";

export function CancelAppointmentButton({ token, slug, hasDeposit, refundable }: { token: string; slug: string; hasDeposit: boolean; refundable: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!asking) return <Button variant="secondary" className="w-full text-status-alert" type="button" onClick={() => setAsking(true)}><Icon name="event_busy" className="text-[18px]" />Cancelar turno</Button>;

  return (
    <div className="space-y-3 rounded-inner border border-status-alert/20 bg-status-alert-bg p-4">
      <div>
        <p className="font-label-lg text-label-lg text-on-surface">¿Confirmás la cancelación?</p>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">{!hasDeposit ? "El turno se cancelará de inmediato." : refundable ? "Estás dentro del plazo: corresponde devolver la seña." : "Estás fuera del plazo: la seña no es reembolsable."}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="button" className="w-full" disabled={pending} onClick={() => startTransition(async () => {
          const result = await cancelAppointmentAction(token, slug);
          if (!result.ok) { setMessage(result.error); return; }
          setMessage(result.message);
          router.refresh();
        })}>{pending ? "Cancelando…" : "Sí, cancelar turno"}</Button>
        <Button type="button" variant="ghost" className="w-full" disabled={pending} onClick={() => { setAsking(false); setMessage(null); }}>Volver</Button>
      </div>
      {message && <p role="status" className="font-body-sm text-body-sm text-on-surface">{message}</p>}
    </div>
  );
}
