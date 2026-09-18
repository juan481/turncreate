"use client";

import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type PhaseDraft = { kind: "active" | "wait"; minutes: number };

export function PhasesEditor({
  phases,
  onChange,
}: {
  phases: PhaseDraft[];
  onChange: (phases: PhaseDraft[]) => void;
}) {
  const totalDuration = phases.reduce((sum, p) => sum + p.minutes, 0);

  function updatePhase(index: number, patch: Partial<PhaseDraft>) {
    onChange(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function addPhase() {
    onChange([...phases, { kind: "wait", minutes: 15 }]);
  }

  function removePhase(index: number) {
    onChange(phases.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-label-md text-label-md text-on-surface-variant">Fases del servicio</label>
        <span className="font-label-sm text-label-sm text-on-surface-variant">
          Duración total: {totalDuration} min
        </span>
      </div>

      <div className="space-y-3">
        {phases.map((phase, index) => (
          <div key={index} className="rounded-inner border border-border p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Paso {index + 1}</span>
              {phases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePhase(index)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-status-alert"
                  aria-label="Quitar paso"
                >
                  <Icon name="close" className="text-[16px]" />
                </button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => updatePhase(index, { kind: "active" })}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-inner border-2 p-2.5 text-left transition-all duration-200",
                  phase.kind === "active"
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface-container-low text-on-surface hover:border-outline-variant",
                )}
              >
                <span className="flex items-center gap-1.5 font-label-md text-label-md">
                  <Icon name="content_cut" className="text-[16px]" />
                  El profesional trabaja
                </span>
                <span className={cn("font-body-sm text-body-sm", phase.kind === "active" ? "text-on-primary/80" : "text-on-surface-variant")}>
                  Ej: cortar, aplicar color, masajear
                </span>
              </button>

              <button
                type="button"
                onClick={() => updatePhase(index, { kind: "wait" })}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-inner border-2 p-2.5 text-left transition-all duration-200",
                  phase.kind === "wait"
                    ? "border-primary bg-primary text-on-primary"
                    : "border-border bg-surface-container-low text-on-surface hover:border-outline-variant",
                )}
              >
                <span className="flex items-center gap-1.5 font-label-md text-label-md">
                  <Icon name="hourglass_top" className="text-[16px]" />
                  El cliente espera solo
                </span>
                <span className={cn("font-body-sm text-body-sm", phase.kind === "wait" ? "text-on-primary/80" : "text-on-surface-variant")}>
                  Ej: dejar actuar el color — el profesional queda libre
                </span>
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min="1"
                step="1"
                value={phase.minutes}
                onChange={(e) => updatePhase(index, { minutes: Number(e.target.value) || 0 })}
                className="h-9 w-20"
              />
              <span className="font-body-sm text-body-sm text-on-surface-variant">minutos que dura este paso</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPhase}
        className="flex items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-secondary/80"
      >
        <Icon name="add" className="text-[16px]" />
        Agregar fase
      </button>
    </div>
  );
}
