"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { markDepositRefunded } from "./actions";

/**
 * "Marcar seña devuelta" (turno cancelado con la seña en "Devolver"). Pide
 * una confirmación: después de esto la plata deja de figurar en "A devolver"
 * y los pagos del turno quedan como devueltos en Caja y Reportes.
 */
export function RefundButton({ tenantSlug, appointmentId, amountLabel }: { tenantSlug: string; appointmentId: string; amountLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setError(null);
    startTransition(async () => {
      const result = await markDepositRefunded(tenantSlug, appointmentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show(result.message);
      setAsking(false);
      router.refresh();
    });
  };

  if (!asking) {
    return (
      <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => { setError(null); setAsking(true); }}>
        <Icon name="check_circle" className="text-[18px]" />
        Marcar seña devuelta
      </Button>
    );
  }

  return (
    <div className="animate-fade-up space-y-2 rounded-inner bg-surface-container-low p-3">
      <p className="font-body-sm text-body-sm text-on-surface">
        ¿Ya le devolviste <strong className="tabular-nums">{amountLabel}</strong> a la clienta? Deja de figurar en &ldquo;A devolver&rdquo; y no suma en lo cobrado.
      </p>
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setAsking(false)}>
          No, volver
        </Button>
        <Button type="button" disabled={pending} onClick={run}>
          {pending ? "Guardando…" : "Sí, ya la devolví"}
        </Button>
      </div>
      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
    </div>
  );
}
