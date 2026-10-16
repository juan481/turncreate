"use client";

import { useActionState, useState } from "react";
import { updateDepositSettings, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { calculateDeposit } from "@/domain/money/deposit";
import { cn } from "@/lib/utils";
import { formatMoney } from "./summaries";

const initialState: ConfigActionState = { error: null };

type DepositType = "none" | "percent" | "fixed";

const OPTIONS: { key: DepositType; label: string }[] = [
  { key: "none", label: "Sin seña" },
  { key: "percent", label: "% del servicio" },
  { key: "fixed", label: "Monto fijo" },
];

/** Precio de ejemplo para mostrar en vivo cuánto daría la seña. */
const SAMPLE_PRICE = 20_000;
const LABEL = "font-label-md text-label-md text-on-surface-variant";

export function DepositSettingsForm({
  tenantSlug,
  current,
}: {
  tenantSlug: string;
  current: { depositType: DepositType; depositValue: number; depositMin: number };
}) {
  const toast = useToast();
  const [type, setType] = useState<DepositType>(current.depositType);
  const [value, setValue] = useState(String(current.depositValue || ""));
  const [min, setMin] = useState(String(current.depositMin || ""));
  const [state, formAction, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateDepositSettings(tenantSlug, prev, formData);
    if (result.success) toast.show(formData.get("depositType") === "none" ? "Listo: tu turnero no pide seña" : "Seña guardada");
    return result;
  }, initialState);

  const numericValue = Number(value) || 0;
  const numericMin = type === "percent" ? Number(min) || 0 : 0;
  const sample = type === "none" ? 0 : calculateDeposit(SAMPLE_PRICE, { type, value: numericValue, min: numericMin });

  return (
    <form action={formAction} className="min-w-0 space-y-3">
      <div role="radiogroup" aria-label="Tipo de seña" className="grid grid-cols-3 gap-1 rounded-pill bg-surface-container p-1">
        {OPTIONS.map((opt) => (
          <label
            key={opt.key}
            className={cn(
              "flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-pill px-1 text-center font-label-md text-label-md transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-secondary",
              type === opt.key ? "bg-primary text-on-primary shadow-card" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <input
              type="radio"
              name="depositType"
              value={opt.key}
              checked={type === opt.key}
              onChange={() => setType(opt.key)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {type === "none" ? (
        <p className="rounded-inner bg-status-draft-bg px-3 py-2.5 font-body-sm text-body-sm text-status-draft">
          Sin seña, el turnero público no toma reservas online: las clientas te van a tener que escribir para pedir turno.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="deposit-value" className={LABEL}>{type === "percent" ? "Porcentaje del servicio (%)" : "Monto de la seña ($)"}</label>
              <Input
                id="deposit-value"
                name="depositValue"
                type="number"
                inputMode="decimal"
                min="0"
                max={type === "percent" ? "100" : undefined}
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
              />
            </div>
            {type === "percent" ? (
              <div className="min-w-0 space-y-1.5">
                <label htmlFor="deposit-min" className={LABEL}>Mínimo ($, opcional)</label>
                <Input id="deposit-min" name="depositMin" type="number" inputMode="decimal" min="0" step="0.01" value={min} onChange={(event) => setMin(event.target.value)} placeholder="0" />
              </div>
            ) : (
              <input type="hidden" name="depositMin" value="0" />
            )}
          </div>
          <div className="space-y-1 rounded-inner bg-surface-container-low px-3 py-2.5">
            <p className="font-body-md text-body-md text-on-surface">
              Con un servicio de <span className="tabular-nums">{formatMoney(SAMPLE_PRICE)}</span>, la seña sería{" "}
              <strong className="tabular-nums">{formatMoney(sample)}</strong>.
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              La seña nunca supera el precio del servicio: si pedís {formatMoney(10_000)} y el servicio sale {formatMoney(6_000)}, se cobran {formatMoney(6_000)}.
              {type === "percent" && " Si el porcentaje da menos que el mínimo, se cobra el mínimo."}
            </p>
          </div>
        </>
      )}

      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Guardar seña"}
      </Button>
    </form>
  );
}
