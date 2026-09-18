"use client";

import { useActionState, useState } from "react";
import { createService, type ServiceActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhasesEditor, type PhaseDraft } from "./phases-editor";

const initialState: ServiceActionState = { error: null };

const DEFAULT_PHASES: PhaseDraft[] = [{ kind: "active", minutes: 30 }];

export function NewServiceForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createService.bind(null, tenantSlug),
    initialState,
  );
  const [phases, setPhases] = useState<PhaseDraft[]>(DEFAULT_PHASES);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);

  return (
    <form action={formAction} className="space-y-md">
      <input type="hidden" name="phases" value={JSON.stringify(phases)} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
          <Input name="name" placeholder="Corte de pelo" required />
        </div>
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">Precio</label>
          <Input name="price" type="number" min="0" step="0.01" required />
        </div>
      </div>

      <PhasesEditor phases={phases} onChange={setPhases} />

      <div className="max-w-[220px] space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Limpieza después del turno
        </label>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Minutos que bloqueás en la agenda para ordenar o higienizar antes del próximo cliente. No se cobra.
        </p>
        <Input
          type="number"
          min="0"
          step="1"
          value={bufferAfterMin}
          onChange={(e) => setBufferAfterMin(Number(e.target.value) || 0)}
        />
        <input type="hidden" name="bufferAfterMin" value={bufferAfterMin} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Agregar servicio"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
