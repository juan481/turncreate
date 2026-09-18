"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateStaffServices, type StaffActionState } from "./actions";
import { ServicesCheckboxList, type ServiceOption } from "./services-checkbox-list";

const initialState: StaffActionState = { error: null };

export function EditStaffServicesForm({
  tenantSlug,
  staffId,
  services,
  defaultSelected,
}: {
  tenantSlug: string;
  staffId: string;
  services: ServiceOption[];
  defaultSelected: string[];
}) {
  const [state, formAction, pending] = useActionState(
    updateStaffServices.bind(null, tenantSlug, staffId),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <ServicesCheckboxList services={services} defaultSelected={defaultSelected} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar servicios"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
