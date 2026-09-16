"use client";

import { useActionState } from "react";
import { changeStatus, type ChangeStatusState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ChangeStatusState = { error: null };

const NEXT_STATUSES: Record<string, { toStatus: string; label: string; variant: "primary" | "secondary" }[]> = {
  pending_payment: [
    { toStatus: "confirmed", label: "Marcar como pagado", variant: "primary" },
    { toStatus: "cancelled", label: "Cancelar", variant: "secondary" },
  ],
  confirmed: [
    { toStatus: "completed", label: "Finalizar turno", variant: "primary" },
    { toStatus: "no_show", label: "No vino", variant: "secondary" },
    { toStatus: "cancelled", label: "Cancelar", variant: "secondary" },
  ],
};

export function StatusActions({
  tenantSlug,
  appointmentId,
  dateISO,
  status,
}: {
  tenantSlug: string;
  appointmentId: string;
  dateISO: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState(
    changeStatus.bind(null, tenantSlug, appointmentId, dateISO),
    initialState,
  );

  const options = NEXT_STATUSES[status] ?? [];
  if (options.length === 0) return null;

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Motivo (solo si cancelás)
        </label>
        <Input name="reason" placeholder="El cliente avisó que no puede venir" />
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.toStatus}
            type="submit"
            name="toStatus"
            value={option.toStatus}
            variant={option.variant}
            disabled={pending}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
