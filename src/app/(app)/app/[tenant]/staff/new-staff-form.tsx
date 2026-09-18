"use client";

import { useActionState } from "react";
import { addStaff, type StaffActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ServicesCheckboxList, type ServiceOption } from "./services-checkbox-list";

const initialState: StaffActionState = { error: null };

export function NewStaffForm({ tenantSlug, services }: { tenantSlug: string; services: ServiceOption[] }) {
  const [state, formAction, pending] = useActionState(
    addStaff.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Nombre del profesional
          </label>
          <Input name="displayName" placeholder="Sofía Martín" required />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Agregando…" : "Agregar"}
        </Button>
      </div>

      <ServicesCheckboxList services={services} />

      {state.error && (
        <p className="w-full font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
