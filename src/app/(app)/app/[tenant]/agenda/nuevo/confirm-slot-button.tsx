"use client";

import { useActionState } from "react";
import { confirmAppointment, type ConfirmAppointmentState } from "./actions";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const initialState: ConfirmAppointmentState = { error: null };

/**
 * Botón final "Crear turno" del paso Resumen. Manda al server action los
 * mismos campos de siempre (confirmAppointment no cambió); antes había un
 * botón de estos por cada horario, ahora el horario ya viene elegido.
 *
 * Arreglo de paso: la nota del turno solo se mandaba si además se cobraba
 * seña (estaba adentro del bloque de depositAmount) -- una nota sin seña
 * se perdía en silencio. Ahora va siempre.
 */
export function ConfirmSlotButton(props: {
  tenantSlug: string;
  staffId: string;
  clientId: string;
  serviceId: string;
  dateISO: string;
  startsAtISO: string;
  rescheduleFrom?: string;
  keepDeposit?: boolean;
  depositAmount?: number;
  depositMethod?: "cash" | "mercadopago" | "transfer" | "card_posnet";
  appointmentNote?: string;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState(
    confirmAppointment.bind(null, props.tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="staffId" value={props.staffId} />
      <input type="hidden" name="clientId" value={props.clientId} />
      <input type="hidden" name="serviceId" value={props.serviceId} />
      <input type="hidden" name="date" value={props.dateISO} />
      <input type="hidden" name="startsAt" value={props.startsAtISO} />
      <input type="hidden" name="appointmentNote" value={props.appointmentNote ?? ""} />
      {props.rescheduleFrom && (
        <input type="hidden" name="rescheduleFrom" value={props.rescheduleFrom} />
      )}
      {props.rescheduleFrom && (
        <input type="hidden" name="keepDeposit" value={props.keepDeposit === false ? "false" : "true"} />
      )}
      {props.depositAmount ? (
        <>
          <input type="hidden" name="depositAmount" value={props.depositAmount} />
          <input type="hidden" name="depositMethod" value={props.depositMethod} />
        </>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            Creando turno…
          </>
        ) : (
          <>
            <Icon name="check" className="text-[18px]" />
            {props.label ?? "Crear turno"}
          </>
        )}
      </Button>
      {state.error && (
        <p role="alert" className="font-body-sm text-body-sm text-status-alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
