"use client";

import { useActionState, useState } from "react";
import { changeStatus, type ChangeStatusState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ChangeStatusState = { error: null };
const NEEDS_DETAILS = new Set(["no_show", "cancelled", "confirmed"]);
const NEXT_STATUSES: Record<string, { toStatus: string; label: string; variant: "primary" | "secondary" }[]> = {
  pending_payment: [{ toStatus: "confirmed", label: "Registrar pago", variant: "primary" }, { toStatus: "cancelled", label: "Cancelar", variant: "secondary" }],
  confirmed: [{ toStatus: "completed", label: "Finalizar turno", variant: "primary" }, { toStatus: "no_show", label: "No vino", variant: "secondary" }, { toStatus: "cancelled", label: "Cancelar", variant: "secondary" }],
};

export function StatusActions({ tenantSlug, appointmentId, dateISO, status, depositPaid = 0 }: { tenantSlug: string; appointmentId: string; dateISO: string; status: string; depositPaid?: number }) {
  const [state, formAction, pending] = useActionState(changeStatus.bind(null, tenantSlug, appointmentId, dateISO), initialState);
  const [confirming, setConfirming] = useState<string | null>(null);
  const options = NEXT_STATUSES[status] ?? [];
  if (options.length === 0) return null;
  const confirmingOption = options.find((option) => option.toStatus === confirming);
  return <form action={formAction} className="space-y-3">
    <div className="flex flex-wrap gap-2">{options.map((option) => NEEDS_DETAILS.has(option.toStatus)
      ? <Button key={option.toStatus} type="button" variant={option.variant} onClick={() => setConfirming(confirming === option.toStatus ? null : option.toStatus)}>{option.label}</Button>
      : <Button key={option.toStatus} type="submit" name="toStatus" value={option.toStatus} variant={option.variant} disabled={pending}>{option.label}</Button>)}</div>
    {confirmingOption && <div className="animate-fade-up space-y-2 rounded-inner bg-surface-container-low p-3">
      {confirming === "confirmed" ? <>
        <label className="font-label-md text-label-md text-on-surface-variant">Monto cobrado</label>
        <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
        <label className="font-label-md text-label-md text-on-surface-variant">Medio de pago</label>
        <select name="method" required className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="card_posnet">Posnet</option><option value="mercadopago">Mercado Pago</option></select>
      </> : <>
        <label className="font-label-md text-label-md text-on-surface-variant">Motivo de &ldquo;{confirmingOption.label}&rdquo;</label>
        <Input name="reason" placeholder="Contanos qué pasó" autoFocus />
        {confirming === "cancelled" && depositPaid > 0 && <><label className="font-label-md text-label-md text-on-surface-variant">Qué hacer con la seña</label><select name="depositDisposition" required className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base"><option value="">Elegir</option><option value="retained">Retener seña</option><option value="refund_required">Devolver</option><option value="credit">Dejar a favor</option></select></>}
      </>}
      <Button type="submit" name="toStatus" value={confirming ?? ""} variant="secondary" disabled={pending}>{pending ? "Guardando⬦" : "Confirmar"}</Button>
    </div>}
    {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
  </form>;
}
