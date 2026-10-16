"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateTransferSettings, type TransferActionState } from "./actions";
import { SwitchRow } from "./switch-row";
import { BANK_MAX_LENGTH, HOLDER_MAX_LENGTH, validateTransfer, type TransferFieldErrors } from "./transfer-validation";

const initial: TransferActionState = { error: null };
const LABEL = "font-label-md text-label-md text-on-surface-variant";

type Field = keyof TransferFieldErrors;

export function TransferSettingsForm({
  tenantSlug,
  current,
  confirmWindowHours,
}: {
  tenantSlug: string;
  current: { enabled: boolean; alias: string; cbu: string | null; holderName: string; bankName: string | null };
  confirmWindowHours: number;
}) {
  const toast = useToast();
  const [enabled, setEnabled] = useState(current.enabled);
  const [values, setValues] = useState({
    alias: current.alias,
    cbu: current.cbu ?? "",
    holderName: current.holderName,
    bankName: current.bankName ?? "",
  });
  // Los errores del cliente aparecen recién cuando la dueña sale del campo
  // (o intenta guardar), no mientras escribe la primera letra.
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [state, action, pending] = useActionState(async (prev: TransferActionState, formData: FormData) => {
    const result = await updateTransferSettings(tenantSlug, prev, formData);
    if (result.success) {
      toast.show(formData.get("enabled") === "on" ? "Transferencia activada" : "Datos de transferencia guardados");
    }
    return result;
  }, initial);

  const { errors } = validateTransfer({ enabled, ...values });
  const errorFor = (field: Field) => (touched[field] ? errors[field] : state.fieldErrors?.[field]);

  function bind(field: Field) {
    return {
      id: `transfer-${field}`,
      name: field,
      value: values[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        setValues((prev) => ({ ...prev, [field]: field === "alias" ? raw.toLowerCase() : raw }));
      },
      onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
      "aria-invalid": Boolean(errorFor(field)),
      "aria-describedby": errorFor(field) ? `transfer-${field}-error` : undefined,
    };
  }

  function fieldError(field: Field) {
    const message = errorFor(field);
    return message ? (
      <p id={`transfer-${field}-error`} role="alert" className="font-body-sm text-body-sm text-status-alert">
        {message}
      </p>
    ) : null;
  }

  return (
    <form
      action={action}
      onSubmit={() => setTouched({ alias: true, cbu: true, holderName: true, bankName: true })}
      className="min-w-0 space-y-3"
    >
      {enabled && <input type="hidden" name="enabled" value="on" />}
      <SwitchRow
        checked={enabled}
        onChange={setEnabled}
        title="Aceptar seña por transferencia"
        description={`Con transferencia, el turno queda pendiente hasta que confirmes el comprobante. Si no lo confirmás en ${confirmWindowHours} horas, el horario se libera.`}
      />

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="transfer-alias" className={LABEL}>Alias{enabled ? "" : " (opcional por ahora)"}</label>
          <Input {...bind("alias")} maxLength={20} placeholder="mi.local.mp" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
          {fieldError("alias")}
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="transfer-cbu" className={LABEL}>CBU o CVU (opcional)</label>
          <Input {...bind("cbu")} inputMode="numeric" maxLength={30} placeholder="22 números" autoComplete="off" className="tabular-nums" />
          {fieldError("cbu")}
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="transfer-holderName" className={LABEL}>Titular de la cuenta</label>
          <Input {...bind("holderName")} maxLength={HOLDER_MAX_LENGTH} placeholder="Nombre y apellido o razón social" autoComplete="off" />
          {fieldError("holderName")}
        </div>
        <div className="min-w-0 space-y-1.5">
          <label htmlFor="transfer-bankName" className={LABEL}>Banco o billetera (opcional)</label>
          <Input {...bind("bankName")} maxLength={BANK_MAX_LENGTH} placeholder="Ej.: Banco Nación, Ualá" autoComplete="off" />
          {fieldError("bankName")}
        </div>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        La clienta ve el alias, el titular y el monto de la seña antes de transferir, y te puede mandar el comprobante por WhatsApp.
      </p>

      {state.error && !state.fieldErrors && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Guardando…" : "Guardar transferencia"}
      </Button>
    </form>
  );
}
