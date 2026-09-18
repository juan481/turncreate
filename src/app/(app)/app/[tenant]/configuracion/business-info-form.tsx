"use client";

import { useActionState } from "react";
import { updateBusinessInfo, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: ConfigActionState = { error: null };

export function BusinessInfoForm({
  tenantSlug,
  tenant,
}: {
  tenantSlug: string;
  tenant: { name: string; address: string | null; instagramUrl: string | null; whatsappNumber: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessInfo.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Nombre del local</label>
        <Input name="name" defaultValue={tenant.name} required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Dirección</label>
        <Input name="address" defaultValue={tenant.address ?? ""} placeholder="Av. Santa Fe 1234, CABA" />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Instagram</label>
        <Input name="instagramUrl" defaultValue={tenant.instagramUrl ?? ""} placeholder="https://instagram.com/tu_local" />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">WhatsApp del local</label>
        <Input name="whatsappNumber" defaultValue={tenant.whatsappNumber ?? ""} placeholder="+5491122334455" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </div>
      {state.error && (
        <p className="sm:col-span-2 font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
      {state.success && (
        <p className="sm:col-span-2 font-body-sm text-body-sm text-status-confirmed">Datos actualizados.</p>
      )}
    </form>
  );
}
