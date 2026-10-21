"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toast";
import { checkoutAmounts, roundMoney } from "@/domain/money/payment";
import { cn } from "@/lib/utils";
import { disconnectMercadoPago, updateMercadoPagoEnabled, updateMercadoPagoSettings, type ConfigActionState } from "./actions";
import { formatMoney, formatPercent } from "./summaries";
import { SwitchRow } from "./switch-row";

const initial: ConfigActionState = { error: null };

type FeeMode = "absorbed" | "passed_through";
type ConnectionStatus = "connected" | "reconnect_required" | "disconnected";

/** Seña de ejemplo para explicar la comisión con números concretos. */
const SAMPLE_DEPOSIT = 10_000;

function parsePercent(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 50 ? parsed : null;
}

function feeExample(mode: FeeMode, percent: number) {
  const { appliedAmount, grossAmount } = checkoutAmounts({ depositAmount: SAMPLE_DEPOSIT, feeMode: mode, feeRate: percent / 100 });
  const fee = roundMoney(grossAmount * (percent / 100));
  return { clientPays: grossAmount, youGet: mode === "absorbed" ? roundMoney(appliedAmount - fee) : appliedAmount, fee };
}

export function MercadoPagoSettings({
  tenantSlug,
  status,
  enabled,
  feeMode,
  feePercent,
  observedFee,
}: {
  tenantSlug: string;
  status: ConnectionStatus;
  /** settings.payments.mercadopagoEnabled (sin dato = true). */
  enabled: boolean;
  feeMode: FeeMode;
  feePercent: number;
  observedFee: { percent: number; paidAt: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const connected = status === "connected";
  const connectHref = `/api/integrations/mercadopago/connect?tenant=${encodeURIComponent(tenantSlug)}`;

  const [mode, setMode] = useState<FeeMode>(feeMode);
  const [percent, setPercent] = useState(String(feePercent));
  const parsed = parsePercent(percent);
  const examplePercent = parsed ?? 0;

  const [state, action, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateMercadoPagoSettings(tenantSlug, prev, formData);
    if (result.success) toast.show("Comisión guardada");
    return result;
  }, initial);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnectState, disconnectAction, disconnecting] = useActionState(async (prev: ConfigActionState) => {
    const result = await disconnectMercadoPago(tenantSlug, prev);
    if (result.success) {
      setConfirmDisconnect(false);
      toast.show("Desconectamos tu cuenta de Mercado Pago", "info");
    }
    return result;
  }, initial);

  const [mpEnabled, setMpEnabled] = useState(enabled);
  const [toggling, startToggle] = useTransition();
  function toggleEnabled(next: boolean) {
    setMpEnabled(next);
    startToggle(async () => {
      const result = await updateMercadoPagoEnabled(tenantSlug, next);
      if (result.error) {
        setMpEnabled(!next);
        toast.show(result.error, "error");
        return;
      }
      toast.show(next ? "Las clientas van a poder pagar la seña con Mercado Pago" : "El turnero ya no ofrece Mercado Pago");
      router.refresh();
    });
  }

  const absorbed = feeExample("absorbed", examplePercent);
  const passed = feeExample("passed_through", examplePercent);
  const hasPercent = examplePercent > 0;

  const feeOptions: { key: FeeMode; title: string; body: string }[] = [
    {
      key: "absorbed",
      title: "Descontarla de lo que recibo",
      body: hasPercent
        ? `La clienta paga ${formatMoney(absorbed.clientPays)}. Mercado Pago descuenta ${formatMoney(absorbed.fee)} y vos recibís aproximadamente ${formatMoney(absorbed.youGet)}.`
        : `La clienta paga ${formatMoney(SAMPLE_DEPOSIT)}. Mercado Pago descuenta su comisión antes de acreditarte el dinero.`,
    },
    {
      key: "passed_through",
      title: "Sumarla al pago de la clienta",
      body: hasPercent
        ? `La clienta paga ${formatMoney(passed.clientPays)} en total y vos recibís aproximadamente ${formatMoney(SAMPLE_DEPOSIT)}.`
        : `La clienta paga la seña más la comisión para que vos recibas el monto completo de la seña.`,
    },
  ];

  return (
    <div className="min-w-0 space-y-md" data-mp-marketplace-page="checkout-pro">
      {/* Estado de la cuenta: el logo se ve siempre, conectada o no. */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-inner bg-surface-container-low p-md">
        <MercadoPagoLogo withWordmark label="Mercado Pago" className="min-w-0 max-w-full text-[28px] sm:text-[32px]" />
        <StatusPill status={connected ? "confirmed" : status === "reconnect_required" ? "alert" : "draft"} className="shrink-0">
          {connected ? "Conectada" : status === "reconnect_required" ? "Reconectar" : "Sin conectar"}
        </StatusPill>
      </div>

      {connected ? (
        <p className="font-body-md text-body-md text-on-surface-variant">
          Las señas se acreditan directo en tu cuenta de Mercado Pago. TurnCreate no cobra comisión propia.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="font-body-md text-body-md text-on-surface-variant">
            {status === "reconnect_required"
              ? "Mercado Pago cortó la conexión con tu cuenta. Volvé a conectarla para seguir cobrando señas online."
              : "Conectá tu cuenta para que las clientas paguen la seña con tarjeta, débito o dinero en cuenta. La plata se acredita directo en tu Mercado Pago."}
          </p>
          <a href={connectHref} data-mp-marketplace-connect="oauth" className={cn(buttonVariants(), "w-full sm:w-auto")}>
            <MercadoPagoLogo chip className="text-[18px]" />
            {status === "reconnect_required" ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
          </a>
        </div>
      )}

      <SwitchRow
        checked={connected && mpEnabled}
        onChange={toggleEnabled}
        disabled={!connected || toggling}
        title="Cobrar la seña con Mercado Pago"
        description={connected ? (mpEnabled ? "El turnero ofrece pagar la seña con Mercado Pago." : "Apagado: la cuenta sigue conectada, pero el turnero no lo ofrece.") : "Disponible cuando conectes tu cuenta."}
      />

      <form action={action} className="min-w-0 space-y-3">
        <fieldset disabled={!connected || pending} className={cn("min-w-0 space-y-3", !connected && "opacity-70")}>
          <legend className="mb-1 font-label-lg text-label-lg text-on-surface">¿Quién paga la comisión de Mercado Pago?</legend>
          {!connected && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Conectá tu cuenta para guardar esta elección. Mientras tanto, podés comparar cómo se calcula cada alternativa.</p>
          )}
          <div role="radiogroup" aria-label="Quién paga la comisión" className="grid grid-cols-1 gap-2">
            {feeOptions.map((option) => (
              <label
                key={option.key}
                className={cn(
                  "flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-inner border-2 px-3 py-2.5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-secondary has-[input:disabled]:cursor-not-allowed",
                  mode === option.key ? "border-primary bg-secondary-soft" : "border-border bg-surface",
                )}
              >
                <input type="radio" name="feeMode" value={option.key} checked={mode === option.key} onChange={() => setMode(option.key)} className="sr-only" />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2",
                    mode === option.key ? "border-primary" : "border-outline-variant",
                  )}
                >
                  {mode === option.key && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-label-lg text-label-lg text-on-surface">{option.title}</span>
                  <span className="block font-body-sm text-body-sm tabular-nums text-on-surface-variant">
                    Ejemplo con una seña de {formatMoney(SAMPLE_DEPOSIT)}: {option.body}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="min-w-0 space-y-1.5">
            <label htmlFor="mp-fee-percent" className="font-label-md text-label-md text-on-surface-variant">Comisión de tu cuenta (%)</label>
            <Input
              id="mp-fee-percent"
              name="feePercent"
              type="number"
              inputMode="decimal"
              min="0"
              max="49.99"
              step="0.01"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              aria-invalid={parsed === null}
              className="sm:max-w-[12rem]"
            />
            {parsed === null && <p role="alert" className="font-body-sm text-body-sm text-status-alert">Ingresá un porcentaje entre 0 y 49,99.</p>}
            {!hasPercent && parsed !== null && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Cargá el % de tu cuenta para ver los ejemplos con números reales.</p>
            )}
          </div>
          {connected && observedFee && observedFee.percent !== parsed && (
            <button
              type="button"
              onClick={() => setPercent(String(observedFee.percent))}
              className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-inner bg-surface-container-low px-3 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors active:bg-surface-container"
            >
              <Icon name="auto_awesome" className="shrink-0 text-[16px] text-secondary" />
              <span className="min-w-0 flex-1">
                <strong className="tabular-nums">Usar {formatPercent(observedFee.percent)}</strong> · lo que te cobró Mercado Pago en tu último cobro
              </span>
            </button>
          )}
          <p className="flex gap-2 rounded-inner bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="info" className="mt-0.5 shrink-0 text-[16px] text-secondary" />
            <span className="min-w-0">
              Mercado Pago cobra una comisión por cada cobro; el % depende de tu cuenta y del plazo de acreditación. Con este número se calcula
              cuánto se le suma a la clienta; en cada pago queda guardada la comisión real que cobró Mercado Pago.
            </span>
          </p>
          {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
          <Button type="submit" className="w-full sm:w-auto" disabled={!connected || pending || parsed === null}>
            {pending ? "Guardando…" : "Guardar comisión"}
          </Button>
        </fieldset>
      </form>

      {connected && (
        <form action={disconnectAction} className="space-y-2 border-t border-border pt-md">
          {confirmDisconnect ? (
            <>
              <p className="font-body-sm text-body-sm text-on-surface">
                ¿Desconectar tu cuenta? El turnero deja de ofrecer Mercado Pago hasta que la vuelvas a conectar.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" className="text-status-alert" disabled={disconnecting}>
                  {disconnecting ? "Desconectando…" : "Sí, desconectar"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDisconnect(false)} disabled={disconnecting}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" variant="ghost" className="-ml-2 text-on-surface-variant" onClick={() => setConfirmDisconnect(true)}>
              Desconectar cuenta
            </Button>
          )}
          {disconnectState.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{disconnectState.error}</p>}
        </form>
      )}
    </div>
  );
}
