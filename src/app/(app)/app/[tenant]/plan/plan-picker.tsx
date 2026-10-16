"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import type { PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { startSubscription, type PlanActionState } from "./actions";

export type PlanOption = {
  id: PlanId;
  name: string;
  /** Ya formateado ("$34.900"). */
  price: string;
  staffLabel: string;
  maxStaff: number;
};

const initial: PlanActionState = { error: null };

function PlanCardBody({ option, current }: { option: PlanOption; current: boolean }) {
  return (
    <>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate font-headline-sm text-headline-sm text-on-surface">{option.name}</span>
        {current && <span className="shrink-0 rounded-pill bg-secondary-soft px-2 py-0.5 font-label-sm text-label-sm text-primary">Tu plan</span>}
      </div>
      <p className="tabular-nums">
        <span className="font-headline-md text-headline-md text-on-surface">{option.price}</span>
        <span className="font-body-sm text-body-sm text-on-surface-variant"> /mes</span>
      </p>
      <p className="flex min-w-0 items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
        <Icon name="group" className="shrink-0 text-[16px]" />
        <span className="min-w-0 truncate">{option.staffLabel}</span>
      </p>
    </>
  );
}

const CARD_CLASS = "flex min-h-11 min-w-0 flex-col gap-1.5 rounded-inner border bg-surface p-4 text-left";

/**
 * Los 3 planes + el botón de Mercado Pago. `canSubscribe=false` (ya está al
 * día, o no es quien administra) muestra los planes solo para mirar.
 */
export function PlanPicker({
  tenantSlug,
  options,
  currentPlan,
  canSubscribe,
  checkoutAvailable,
  defaultEmail,
  activeStaffCount,
  ctaHint,
}: {
  tenantSlug: string;
  options: PlanOption[];
  currentPlan: PlanId;
  canSubscribe: boolean;
  checkoutAvailable: boolean;
  defaultEmail: string;
  activeStaffCount: number;
  /** Línea chica arriba del botón (ej. "Es opcional: hoy no pagás nada"). */
  ctaHint?: string;
}) {
  const [selected, setSelected] = useState<PlanId>(currentPlan);
  const [leaving, setLeaving] = useState(false);
  const [state, action, pending] = useActionState(async (prev: PlanActionState, formData: FormData) => {
    const result = await startSubscription(tenantSlug, prev, formData);
    if (result.initPoint) {
      // Sale a Mercado Pago; vuelve a /plan?mp=subscribed.
      setLeaving(true);
      window.location.assign(result.initPoint);
    }
    return result;
  }, initial);

  if (!canSubscribe) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <div key={option.id} className={cn(CARD_CLASS, option.id === currentPlan ? "border-primary/40 bg-secondary-soft/40" : "border-border")}>
            <PlanCardBody option={option} current={option.id === currentPlan} />
          </div>
        ))}
      </div>
    );
  }

  const selectedOption = options.find((option) => option.id === selected);
  const overStaff = selectedOption && activeStaffCount > selectedOption.maxStaff;
  const busy = pending || leaving;

  return (
    <form action={action} className="space-y-md">
      <fieldset className="min-w-0">
        <legend className="sr-only">Elegí tu plan</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {options.map((option) => (
            <label
              key={option.id}
              className={cn(
                CARD_CLASS,
                "cursor-pointer border-border transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary-soft/40 has-[:checked]:ring-2 has-[:checked]:ring-primary/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-secondary",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={option.id}
                checked={selected === option.id}
                onChange={() => setSelected(option.id)}
                className="sr-only"
              />
              <PlanCardBody option={option} current={option.id === currentPlan} />
            </label>
          ))}
        </div>
      </fieldset>

      {overStaff && selectedOption && (
        <p className="flex min-w-0 gap-2 rounded-inner bg-status-draft-bg px-3 py-2.5 font-body-sm text-body-sm text-status-draft">
          <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
          <span className="min-w-0">
            Hoy tenés {activeStaffCount} profesionales activos y el plan {selectedOption.name} permite {selectedOption.maxStaff === 1 ? "1" : `hasta ${selectedOption.maxStaff}`}. Vas a tener que desactivar a alguien del equipo.
          </span>
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="payerEmail" className="block font-label-lg text-label-lg text-on-surface">
          Email de tu cuenta de Mercado Pago
        </label>
        <Input id="payerEmail" name="payerEmail" type="email" inputMode="email" autoComplete="email" required defaultValue={defaultEmail} disabled={busy} />
        <p className="font-body-sm text-body-sm text-on-surface-variant">Mercado Pago te lo pide para asociar la suscripción a tu cuenta. Si usás otro email allá, cambialo acá.</p>
      </div>

      {ctaHint && <p className="font-body-sm text-body-sm text-on-surface-variant">{ctaHint}</p>}

      <Button type="submit" disabled={!checkoutAvailable || busy} className="h-12 w-full sm:w-auto sm:min-w-[18rem]">
        {busy ? (
          <>
            <Icon name="progress_activity" className="animate-spin text-[18px] motion-reduce:animate-none" />
            {leaving ? "Abriendo Mercado Pago…" : "Preparando…"}
          </>
        ) : (
          <>
            <MercadoPagoLogo chip className="text-[18px]" />
            <span className="min-w-0 truncate">Suscribirme con Mercado Pago</span>
          </>
        )}
      </Button>

      {!checkoutAvailable && (
        <p className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Icon name="schedule" className="shrink-0 text-[16px]" />
          <span className="min-w-0">El cobro con Mercado Pago se habilita muy pronto.</span>
        </p>
      )}

      {state.error && (
        <p role="alert" className="flex min-w-0 gap-2 rounded-inner bg-status-alert-bg px-3 py-2.5 font-body-sm text-body-sm text-status-alert">
          <Icon name="warning" className="mt-0.5 shrink-0 text-[16px]" />
          <span className="min-w-0">{state.error}</span>
        </p>
      )}

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Es un débito automático mensual de Mercado Pago: lo podés cancelar cuando quieras desde esta pantalla.
      </p>
    </form>
  );
}
