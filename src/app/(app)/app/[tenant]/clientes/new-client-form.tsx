"use client";

import { useActionState } from "react";
import { addClient, type ClientActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: ClientActionState = { error: null };

export function NewClientForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    addClient.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_2fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Nombre completo
        </label>
        <Input name="fullName" placeholder="Camila Morales" required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Teléfono (WhatsApp)
        </label>
        <Input name="phoneE164" placeholder="+5491144558822" required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Email (opcional)
        </label>
        <Input name="email" type="email" placeholder="camila@gmail.com" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Agregar"}
      </Button>
      {state.error && (
        <p className="sm:col-span-4 font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
