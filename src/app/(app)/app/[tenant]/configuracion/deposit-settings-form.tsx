"use client";

import { useActionState, useState } from "react";
import { updateDepositSettings, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState: ConfigActionState = { error: null };

type DepositType = "none" | "percent" | "fixed";

export function DepositSettingsForm({
  tenantSlug,
  current,
}: {
  tenantSlug: string;
  current: { depositType: DepositType; depositValue: number; depositMin: number };
}) {
  const [state, formAction, pending] = useActionState(
    updateDepositSettings.bind(null, tenantSlug),
    initialState,
  );
  const [type, setType] = useState<DepositType>(current.depositType);

  const OPTIONS: { key: DepositType; label: string }[] = [
    { key: "none", label: "Sin seña" },
    { key: "percent", label: "% del servicio" },
    { key: "fixed", label: "Monto fijo" },
  ];

  return (
    <form action={formAction} className="space-y-3">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Se le exige al cliente cuando reserva desde el turnero público.
      </p>
      <input type="hidden" name="depositType" value={type} />
      <div className="flex flex-wrap items-center gap-1 rounded-pill bg-surface-container p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setType(opt.key)}
            className={cn(
              "rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all",
              type === opt.key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {type !== "none" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant">
              {type === "percent" ? "Porcentaje (%)" : "Monto ($)"}
            </label>
            <Input name="depositValue" type="number" min="0" step="0.01" defaultValue={current.depositValue} />
          </div>
          <div className="space-y-1.5">
            <label className="font-label-sm text-label-sm text-on-surface-variant">Mínimo ($)</label>
            <Input name="depositMin" type="number" min="0" step="0.01" defaultValue={current.depositMin} />
          </div>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar política de seña"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      {state.success && <p className="font-body-sm text-body-sm text-status-confirmed">Política actualizada.</p>}
    </form>
  );
}
