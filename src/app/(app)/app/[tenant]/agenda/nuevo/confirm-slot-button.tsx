"use client";

import { useActionState } from "react";
import { confirmAppointment, type ConfirmAppointmentState } from "./actions";
import { Button } from "@/components/ui/button";

const initialState: ConfirmAppointmentState = { error: null };

export function ConfirmSlotButton(props: {
  tenantSlug: string;
  staffId: string;
  clientId: string;
  serviceId: string;
  dateISO: string;
  startsAtISO: string;
  label: string;
  rescheduleFrom?: string;
}) {
  const [state, formAction, pending] = useActionState(
    confirmAppointment.bind(null, props.tenantSlug),
    initialState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="staffId" value={props.staffId} />
      <input type="hidden" name="clientId" value={props.clientId} />
      <input type="hidden" name="serviceId" value={props.serviceId} />
      <input type="hidden" name="date" value={props.dateISO} />
      <input type="hidden" name="startsAt" value={props.startsAtISO} />
      {props.rescheduleFrom && (
        <input type="hidden" name="rescheduleFrom" value={props.rescheduleFrom} />
      )}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {props.label}
      </Button>
      {state.error && (
        <p className="mt-1 font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
