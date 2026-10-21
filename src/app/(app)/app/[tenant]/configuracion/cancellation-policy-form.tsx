"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateCancellationPolicy, type ConfigActionState } from "./actions";

const initialState: ConfigActionState = { error: null };

export function CancellationPolicyForm({ tenantSlug, hours }: { tenantSlug: string; hours: number }) {
  const toast = useToast();
  const [value, setValue] = useState(String(hours));
  const [state, action, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateCancellationPolicy(tenantSlug, prev, formData);
    if (result.success) toast.show("Política de cancelación guardada");
    return result;
  }, initialState);

  const preview = Number(value);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="cancellation-refund-hours" className="font-label-md text-label-md text-on-surface-variant">Plazo para devolver la seña</label>
        <div className="flex items-center gap-2">
          <Input id="cancellation-refund-hours" name="hours" type="number" min="0" max="720" step="1" value={value} onChange={(event) => setValue(event.target.value)} required className="max-w-[9rem] tabular-nums" />
          <span className="font-body-md text-body-md text-on-surface-variant">horas antes del turno</span>
        </div>
      </div>
      <p className="rounded-inner bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
        La seña se devuelve si la clienta cancela con al menos <strong className="text-on-surface">{Number.isFinite(preview) ? preview : hours} horas</strong> de anticipación. Si cancela después, la seña queda retenida.
      </p>
      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>{pending ? "Guardando…" : "Guardar política"}</Button>
    </form>
  );
}
