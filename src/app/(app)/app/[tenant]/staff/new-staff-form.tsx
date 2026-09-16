"use client";

import { useActionState } from "react";
import { addStaff, type StaffActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: StaffActionState = { error: null };

export function NewStaffForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(
    addStaff.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">
          Nombre del profesional
        </label>
        <Input name="displayName" placeholder="Sofía Martín" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Agregando…" : "Agregar"}
      </Button>
      {state.error && (
        <p className="w-full font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
