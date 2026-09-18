"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { upsertStaffCommission, type CommissionActionState } from "./commission-actions";

const initialState: CommissionActionState = { error: null };

export function CommissionForm({
  tenantSlug,
  staffId,
  current,
}: {
  tenantSlug: string;
  staffId: string;
  current: { type: "percent" | "fixed"; value: number } | null;
}) {
  const [state, formAction, pending] = useActionState(
    upsertStaffCommission.bind(null, tenantSlug, staffId),
    initialState,
  );
  const [type, setType] = useState<"percent" | "fixed">(current?.type ?? "percent");

  return (
    <form action={formAction} className="space-y-2">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Se aplica cuando el servicio o su categoría no tienen una comisión propia definida.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-1 rounded-pill bg-surface-container p-1">
          <button
            type="button"
            onClick={() => setType("percent")}
            className={cn(
              "rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all",
              type === "percent" ? "bg-primary text-on-primary" : "text-on-surface-variant",
            )}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={cn(
              "rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all",
              type === "fixed" ? "bg-primary text-on-primary" : "text-on-surface-variant",
            )}
          >
            $ fijo
          </button>
        </div>
        <input type="hidden" name="type" value={type} />
        <Input
          name="value"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={current?.value}
          placeholder={type === "percent" ? "20" : "5000"}
          className="h-9 w-28"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
