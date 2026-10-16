"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cancelPlanSubscription, type PlanActionState } from "./actions";

const initial: PlanActionState = { error: null };

/** "Cancelar suscripción" con un paso de confirmación (nunca de un toque). */
export function CancelSubscription({ tenantSlug, coveredUntilLabel }: { tenantSlug: string; coveredUntilLabel: string | null }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(async () => {
    const result = await cancelPlanSubscription(tenantSlug);
    if (result.cancelled) {
      setConfirming(false);
      toast.show("Cancelamos tu suscripción. Mercado Pago no te va a cobrar más.", "info");
    }
    return result;
  }, initial);

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setConfirming(true)} className="w-full text-status-alert hover:bg-status-alert-bg sm:w-auto">
        <Icon name="cancel" className="text-[18px]" />
        Cancelar suscripción
      </Button>

      <Modal open={confirming} onClose={() => !pending && setConfirming(false)} title="¿Cancelar tu suscripción?" maxWidth="26rem">
        <div className="space-y-md">
          <p className="font-body-md text-body-md text-on-surface-variant">
            Mercado Pago deja de cobrarte el plan.{" "}
            {coveredUntilLabel
              ? `Tu turnero sigue andando hasta el ${coveredUntilLabel}; después se interrumpe y el panel queda solo para mirar.`
              : "Después tu turnero se interrumpe y el panel queda solo para mirar."}{" "}
            Podés volver a suscribirte cuando quieras.
          </p>
          {state.error && (
            <p role="alert" className="flex min-w-0 gap-2 rounded-inner bg-status-alert-bg px-3 py-2.5 font-body-sm text-body-sm text-status-alert">
              <Icon name="warning" className="mt-0.5 shrink-0 text-[16px]" />
              <span className="min-w-0">{state.error}</span>
            </p>
          )}
          <form action={action} className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              No, volver
            </Button>
            <Button type="submit" disabled={pending} className="bg-status-alert hover:bg-status-alert">
              {pending ? <Icon name="progress_activity" className="animate-spin text-[18px] motion-reduce:animate-none" /> : <Icon name="cancel" className="text-[18px]" />}
              Sí, cancelar
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
