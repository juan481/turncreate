"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { REASON_MAX_LENGTH, REASON_MIN_LENGTH, type TenantStatus } from "@/server/platform/model";
import { setTenantBookingAction, setTenantStatusAction, type PlatformActionResult } from "../actions";

type Intent = "suspend" | "activate" | "booking_off" | "booking_on";

const DESTRUCTIVE = "bg-status-alert text-on-primary hover:bg-status-alert";

function copyFor(intent: Intent, tenantName: string, bookingReady: boolean) {
  switch (intent) {
    case "suspend":
      return {
        title: `Apagar ${tenantName}`,
        body: "El turnero público se cierra y la dueña ve la pantalla de cuenta suspendida al entrar al panel. No se borra nada: lo podés volver a prender cuando quieras.",
        confirm: "Apagar local",
        reasonRequired: true,
        destructive: true,
      };
    case "activate":
      return {
        title: `Prender ${tenantName}`,
        body: "Vuelve a quedar activo: la dueña recupera el panel y el turnero vuelve a tomar reservas (si lo tiene prendido y con la seña configurada).",
        confirm: "Prender local",
        reasonRequired: false,
        destructive: false,
      };
    case "booking_off":
      return {
        title: "Apagar el turnero público",
        body: "Solo cierra las reservas online: el local y el panel de la dueña siguen andando. Ojo: ella lo puede volver a prender desde Configuración.",
        confirm: "Apagar turnero",
        reasonRequired: true,
        destructive: true,
      };
    case "booking_on":
      return {
        title: "Prender el turnero público",
        body: bookingReady
          ? "Las clientas vuelven a poder reservar desde el link del local."
          : "Ojo: todavía no tiene seña o medio de pago listo, así que aunque lo prendas no va a tomar reservas hasta que la dueña lo configure.",
        confirm: "Prender turnero",
        reasonRequired: false,
        destructive: false,
      };
  }
}

/**
 * Prender/apagar el local y, aparte, solo el turnero público. Todo pasa
 * por una hoja de confirmación; apagar pide motivo (queda en la
 * auditoría). La pantalla NO manda el estado actual: la Server Action lo
 * relee en una transacción y rechaza el cambio si ya estaba así.
 */
export function TenantControls({
  tenantId,
  tenantName,
  status,
  bookingEnabled,
  bookingReady,
}: {
  tenantId: string;
  tenantName: string;
  status: TenantStatus;
  bookingEnabled: boolean;
  bookingReady: boolean;
}) {
  const toast = useToast();
  const reasonId = useId();
  const hintId = useId();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isOn = status !== "suspended";
  const copy = intent ? copyFor(intent, tenantName, bookingReady) : null;
  const trimmed = reason.trim();
  const reasonOk = copy ? (copy.reasonRequired ? trimmed.length >= REASON_MIN_LENGTH : trimmed.length === 0 || trimmed.length >= REASON_MIN_LENGTH) : false;

  function open(next: Intent) {
    setIntent(next);
    setReason("");
    setError(null);
  }

  function close() {
    if (pending) return;
    setIntent(null);
  }

  function confirm() {
    if (!intent || !reasonOk) return;
    const current = intent;
    startTransition(async () => {
      setError(null);
      let result: PlatformActionResult;
      if (current === "suspend") result = await setTenantStatusAction(tenantId, "suspended", trimmed);
      else if (current === "activate") result = await setTenantStatusAction(tenantId, "active", trimmed || null);
      else result = await setTenantBookingAction(tenantId, current === "booking_on", trimmed || null);

      if (!result.ok) {
        setError(result.error);
        toast.show(result.error, "error");
        return;
      }
      toast.show(result.message);
      setIntent(null);
    });
  }

  return (
    <div className="space-y-md">
      <div className="space-y-2">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {isOn ? "El local está prendido: la dueña usa el panel y el turnero puede tomar reservas." : "El local está apagado: el turnero no toma reservas y la dueña no puede usar el panel."}
        </p>
        <Button
          type="button"
          className={cn("w-full", isOn && DESTRUCTIVE)}
          onClick={() => open(isOn ? "suspend" : "activate")}
        >
          <Icon name={isOn ? "block" : "check_circle"} className="text-[18px]" />
          {isOn ? "Apagar local" : "Prender local"}
        </Button>
        {status === "trial" && (
          <Button type="button" variant="ghost" className="w-full" onClick={() => open("activate")}>
            Pasar de prueba a activo
          </Button>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-md">
        <p className="font-label-lg text-label-lg text-on-surface">Solo el turnero público</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {bookingEnabled ? "Prendido." : "Apagado."} {isOn ? "" : "Mientras el local esté apagado, no toma reservas igual."}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => open(bookingEnabled ? "booking_off" : "booking_on")}
        >
          <Icon name={bookingEnabled ? "event_busy" : "event_available"} className="text-[18px]" />
          {bookingEnabled ? "Apagar turnero" : "Prender turnero"}
        </Button>
      </div>

      <Modal open={intent !== null} onClose={close} title={copy?.title} variant="sheet">
        {copy && (
          <form
            className="mx-auto w-full max-w-[32rem] space-y-md"
            onSubmit={(event) => {
              event.preventDefault();
              confirm();
            }}
          >
            <p className="font-body-md text-body-md text-on-surface">{copy.body}</p>
            <div className="space-y-1.5">
              <label htmlFor={reasonId} className="block font-label-md text-label-md text-on-surface">
                {copy.reasonRequired ? "Motivo (obligatorio)" : "Nota (opcional)"}
              </label>
              <textarea
                id={reasonId}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={REASON_MAX_LENGTH}
                rows={3}
                required={copy.reasonRequired}
                aria-describedby={hintId}
                placeholder={copy.reasonRequired ? "Ej: no pagó la cuota de octubre" : "Ej: pagó, se reactiva"}
                className="block min-h-24 w-full resize-y rounded-inner border-0 bg-surface-muted px-4 py-3 font-body-lg text-body-lg text-on-surface outline-none ring-2 ring-transparent transition-all placeholder:text-on-surface-variant focus:bg-surface focus:ring-secondary"
              />
              <p id={hintId} className="flex justify-between gap-3 font-label-sm text-label-sm text-on-surface-variant">
                <span>Queda en la auditoría{copy.reasonRequired ? `, mínimo ${REASON_MIN_LENGTH} caracteres` : ""}.</span>
                <span className="shrink-0 tabular-nums">{reason.length}/{REASON_MAX_LENGTH}</span>
              </p>
            </div>
            {error && (
              <p role="alert" className="rounded-inner bg-status-alert-bg px-3.5 py-2.5 font-body-sm text-body-sm text-status-alert">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={close} disabled={pending} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={pending || !reasonOk}
                className={cn("w-full sm:w-auto", copy.destructive && DESTRUCTIVE)}
              >
                {pending && <Icon name="progress_activity" className="animate-spin text-[18px] motion-reduce:animate-none" />}
                {copy.confirm}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
