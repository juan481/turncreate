"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disconnectMercadoPago, updateMercadoPagoSettings, type ConfigActionState } from "./actions";

const initial: ConfigActionState = { error: null };

export function MercadoPagoSettings({ tenantSlug, connected, feeMode, feePercent }: { tenantSlug: string; connected: boolean; feeMode: "absorbed" | "passed_through"; feePercent: number }) {
  const [state, action, pending] = useActionState(updateMercadoPagoSettings.bind(null, tenantSlug), initial);
  const [disconnectState, disconnectAction, disconnecting] = useActionState(disconnectMercadoPago.bind(null, tenantSlug), initial);
  return <div className="space-y-4" data-mp-marketplace-page="checkout-pro">
    {connected ? <form action={action} className="space-y-3">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-11 items-center gap-2 rounded-inner border border-border px-3"><input type="radio" name="feeMode" value="absorbed" defaultChecked={feeMode === "absorbed"} /> Yo absorbo el costo</label>
        <label className="flex min-h-11 items-center gap-2 rounded-inner border border-border px-3"><input type="radio" name="feeMode" value="passed_through" defaultChecked={feeMode === "passed_through"} /> Se suma a la clienta</label>
      </fieldset>
      <label className="block space-y-1"><span className="font-label-md text-label-md text-on-surface-variant">Costo estimado de MP (%)</span><Input name="feePercent" type="number" min="0" max="49.99" step="0.01" defaultValue={feePercent} /></label>
      <p className="font-body-sm text-body-sm text-on-surface-variant">El costo real se guarda cuando llega el pago. TurnCreate no cobra comisiÃ³n propia.</p>
      <Button type="submit" size="sm" disabled={pending}>{pending ? "Guardando..." : "Guardar polÃ­tica"}</Button>
      {state.error && <p className="text-sm text-status-alert">{state.error}</p>}
    </form> : <a href={`/api/integrations/mercadopago/connect?tenant=${encodeURIComponent(tenantSlug)}`} data-mp-marketplace-connect="oauth" className="inline-flex min-h-11 items-center justify-center rounded-pill bg-[#009ee3] px-5 font-label-lg text-white">Conectar Mercado Pago</a>}
    {connected && <form action={disconnectAction}><Button type="submit" variant="ghost" size="sm" disabled={disconnecting}>Desconectar cuenta</Button>{disconnectState.error && <p className="text-sm text-status-alert">{disconnectState.error}</p>}</form>}
  </div>;
}
