"use client";

import { useActionState, useState } from "react";
import { updateBusinessInfo, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

const initialState: ConfigActionState = { error: null };

export function BusinessInfoForm({
  tenantSlug,
  tenant,
}: {
  tenantSlug: string;
  tenant: { name: string; address: string | null; instagramUrl: string | null; whatsappNumber: string | null; logoUrl: string | null };
}) {
  const [state, formAction, pending] = useActionState(
    updateBusinessInfo.bind(null, tenantSlug),
    initialState,
  );
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl ?? "");

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-center gap-3">
        <Avatar name={tenant.name} src={logoUrl || null} size="lg" />
        <div className="flex-1 space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">Logo del local</label>
          <Input
            name="logoUrl"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Se muestra en el selector de local y en tu turnero público. Pegá el link directo a una imagen.
          </p>
        </div>
      </div>
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
