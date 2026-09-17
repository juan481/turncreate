"use client";

import { useActionState, useState } from "react";
import { createService, type ServiceActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const initialState: ServiceActionState = { error: null };

type PhaseDraft = { kind: "active" | "wait"; minutes: number };

const DEFAULT_PHASES: PhaseDraft[] = [{ kind: "active", minutes: 30 }];

export function NewServiceForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createService.bind(null, tenantSlug),
    initialState,
  );
  const [phases, setPhases] = useState<PhaseDraft[]>(DEFAULT_PHASES);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);

  const totalDuration = phases.reduce((sum, p) => sum + p.minutes, 0) + bufferAfterMin;

  function updatePhase(index: number, patch: Partial<PhaseDraft>) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    setPhases((prev) => [...prev, { kind: "wait", minutes: 15 }]);
  }

  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Fases del servicio
          </label>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Duración total: {totalDuration} min
          </span>
        </div>

        <div className="space-y-2">
          {phases.map((phase, index) => (
            <div key={index} className="flex items-center gap-2 rounded-inner bg-surface-muted p-2">
              <select
                value={phase.kind}
                onChange={(e) => updatePhase(index, { kind: e.target.value as PhaseDraft["kind"] })}
                className="h-9 rounded-pill border-0 bg-surface px-3 font-body-sm text-body-sm text-on-surface"
              >
                <option value="active">Activa (ocupa al profesional)</option>
                <option value="wait">Espera (el profesional queda libre)</option>
              </select>
              <Input
                type="number"
                min="1"
                step="1"
                value={phase.minutes}
                onChange={(e) => updatePhase(index, { minutes: Number(e.target.value) || 0 })}
                className="h-9 w-24"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">min</span>
              {phases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePhase(index)}
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface"
                  aria-label="Quitar fase"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addPhase}
          className="font-label-sm text-label-sm text-secondary hover:underline"
        >
          + Agregar fase
        </button>
      </div>

      <div className="max-w-[160px] space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Buffer final (min)
        </label>
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
