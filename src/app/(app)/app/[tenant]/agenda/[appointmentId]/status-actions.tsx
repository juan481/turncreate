"use client";

import { useActionState, useState } from "react";
import { changeStatus, type ChangeStatusState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ChangeStatusState = { error: null };

// Solo no_show/cancelled piden motivo (sección 4.2) -- confirmar o
// finalizar un turno no necesita justificación.
const REQUIRES_REASON = new Set(["no_show", "cancelled"]);

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
  const [confirming, setConfirming] = useState<string | null>(null);

  const options = NEXT_STATUSES[status] ?? [];
  if (options.length === 0) return null;

  const confirmingOption = options.find((o) => o.toStatus === confirming);

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) =>
          REQUIRES_REASON.has(option.toStatus) ? (
            <Button
              key={option.toStatus}
              type="button"
              variant={option.variant}
              onClick={() => setConfirming(confirming === option.toStatus ? null : option.toStatus)}
            >
              {option.label}
            </Button>
          ) : (
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
          ),
        )}
      </div>

      {confirmingOption && (
        <div className="animate-fade-up space-y-2 rounded-inner bg-surface-container-low p-3">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Motivo de &ldquo;{confirmingOption.label}&rdquo;
          </label>
          <Input name="reason" placeholder="Contanos qué pasó" autoFocus />
          <Button type="submit" name="toStatus" value={confirming ?? ""} variant="secondary" disabled={pending}>
            {pending ? "Guardando…" : "Confirmar"}
          </Button>
        </div>
      )}

      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
