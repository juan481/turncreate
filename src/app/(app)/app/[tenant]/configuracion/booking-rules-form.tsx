"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateBookingRules, type ConfigActionState } from "./actions";

const initialState: ConfigActionState = { error: null };
const LABEL = "font-label-md text-label-md text-on-surface-variant";

export function BookingRulesForm({ tenantSlug, slotIntervalMin, minNoticeMin }: { tenantSlug: string; slotIntervalMin: number; minNoticeMin: number }) {
  const toast = useToast();
  const [state, action, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateBookingRules(tenantSlug, prev, formData);
    if (result.success) toast.show("Reglas de turnos guardadas");
    return result;
  }, initialState);

  return (
    <form action={action} className="space-y-md">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="slot-interval" className={LABEL}>Cada cuánto ofrecer un turno</label>
          <select id="slot-interval" name="slotIntervalMin" defaultValue={slotIntervalMin} className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base">
            {[15, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>Cada {minutes} minutos</option>)}
          </select>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Define la separación de la grilla. La duración real se configura en cada servicio.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="min-notice" className={LABEL}>Anticipación mínima para reservar</label>
          <Input id="min-notice" name="minNoticeMin" type="number" min="0" max="43200" step="15" defaultValue={minNoticeMin} required />
          <p className="font-body-sm text-body-sm text-on-surface-variant">En minutos. Ejemplo: 120 significa que deben reservar al menos 2 horas antes.</p>
        </div>
      </div>
      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>{pending ? "Guardando…" : "Guardar reglas"}</Button>
    </form>
  );
}
