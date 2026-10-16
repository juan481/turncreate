"use client";

import { useActionState } from "react";
import { addClient, type ClientActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PHONE_HINT } from "@/lib/phone";
import { MAX_CLIENT_AGE } from "@/lib/schemas/client";

const initialState: ClientActionState = { error: null };

export function NewClientForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    addClient.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block min-w-0 space-y-1.5">
        <span className="font-label-md text-label-md text-on-surface-variant">Nombre completo</span>
        <Input name="fullName" placeholder="Camila Morales" autoComplete="off" required />
      </label>
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="new-client-phone" className="font-label-md text-label-md text-on-surface-variant">
          Teléfono (WhatsApp)
        </label>
        <Input
          id="new-client-phone"
          name="phoneE164"
          type="tel"
          inputMode="tel"
          placeholder="11 2233 4455"
          aria-describedby="new-client-phone-hint"
          autoComplete="off"
          required
        />
        <p id="new-client-phone-hint" className="px-4 font-body-sm text-body-sm text-on-surface-variant">
          {PHONE_HINT}
        </p>
      </div>
      <label className="block min-w-0 space-y-1.5">
        <span className="font-label-md text-label-md text-on-surface-variant">Edad (opcional)</span>
        <Input name="age" type="number" inputMode="numeric" min={1} max={MAX_CLIENT_AGE} step={1} placeholder="Ej: 34" />
      </label>
      <label className="block min-w-0 space-y-1.5">
        <span className="font-label-md text-label-md text-on-surface-variant">Email (opcional)</span>
        <Input name="email" type="email" placeholder="camila@gmail.com" autoComplete="off" />
      </label>
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        {state.error ? (
          <p role="alert" className="font-body-sm text-body-sm text-status-alert">
            {state.error}
          </p>
        ) : (
          <span className="hidden sm:block" />
        )}
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Creando…" : "Agregar"}
        </Button>
      </div>
    </form>
  );
}
