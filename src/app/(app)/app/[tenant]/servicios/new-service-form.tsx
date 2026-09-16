"use client";

import { useActionState } from "react";
import { createService, type ServiceActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: ServiceActionState = { error: null };

export function NewServiceForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    createService.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
        <Input name="name" placeholder="Corte de pelo" required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Precio</label>
        <Input name="price" type="number" min="0" step="0.01" required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Duración (min)</label>
        <Input name="durationMin" type="number" min="1" step="1" required />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Buffer (min)</label>
        <Input name="bufferAfterMin" type="number" min="0" step="1" defaultValue={0} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Agregar"}
      </Button>
      {state.error && (
        <p className="sm:col-span-5 font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
