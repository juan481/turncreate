"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { confirmTransferAction, rejectTransferAction } from "./actions";

/** "Confirmar seña" / "Rechazar" de una transferencia pendiente (lista y detalle del turno). */
export function TransferDecision({ tenantSlug, appointmentId, amountLabel }: { tenantSlug: string; appointmentId: string; amountLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (action: typeof confirmTransferAction) => {
    setError(null);
    startTransition(async () => {
      const result = await action(tenantSlug, appointmentId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show(result.message);
      setConfirmingReject(false);
      router.refresh();
    });
  };

  if (confirmingReject) {
    return (
      <div className="animate-fade-up space-y-2 rounded-inner bg-status-alert-bg p-md">
        <p className="font-body-sm text-body-sm text-status-alert">
          ¿Rechazar la transferencia? El turno se cancela y el horario vuelve a quedar libre.
        </p>
        <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmingReject(false)}>
            No, volver
          </Button>
          <Button type="button" disabled={pending} onClick={() => run(rejectTransferAction)} className="bg-status-alert text-on-primary hover:bg-status-alert">
            {pending ? "Rechazando..." : "Sí, rechazar"}
          </Button>
        </div>
        {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-[1fr_auto]">
        <Button type="button" disabled={pending} onClick={() => run(confirmTransferAction)} className="min-w-0">
          <Icon name="check_circle" className="text-[18px]" />
          <span className="min-w-0 truncate">{pending ? "Confirmando..." : `Confirmar seña ${amountLabel}`}</span>
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => { setError(null); setConfirmingReject(true); }}>
          Rechazar
        </Button>
      </div>
      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
    </div>
  );
}
