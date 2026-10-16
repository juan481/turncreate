"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { longDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ConfirmSlotButton } from "./confirm-slot-button";

export type Slot = { startsAtISO: string; label: string };
type Method = "cash" | "transfer";

/** Lista de horarios libres del día elegido (paso 3). Tocar uno lo elige. */
export function SlotPicker({
  slots,
  value,
  onSelect,
}: {
  slots: Slot[];
  value: string | null;
  onSelect: (slot: Slot) => void;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-inner bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface-variant">
        No quedan horarios libres ese día. Probá con otro día del calendario.
      </p>
    );
  }
  return (
    <div role="group" aria-label="Horarios disponibles" className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {slots.map((slot) => {
        const active = slot.startsAtISO === value;
        return (
          <button
            key={slot.startsAtISO}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(slot)}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center rounded-pill border font-label-md text-label-md tabular-nums transition-colors duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
              active
                ? "border-primary bg-primary text-on-primary"
                : "border-border bg-surface text-on-surface hover:bg-surface-muted",
            )}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon name={icon} className="text-[16px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
        <div className="min-w-0 truncate font-label-lg text-label-lg text-on-surface">{children}</div>
      </div>
    </div>
  );
}

/**
 * Paso 4: resumen de lo elegido + seña/pago (igual que antes) + nota, y el
 * botón final "Crear turno".
 */
export function SummaryStep({
  tenantSlug,
  client,
  service,
  staff,
  dateISO,
  slot,
  suggestedDeposit,
  rescheduleFrom,
  keepDeposit,
}: {
  tenantSlug: string;
  client: { id: string; name: string };
  service: { id: string; name: string; price: number };
  /** id "any" = el primero libre. */
  staff: { id: string; name: string; photoUrl: string | null };
  dateISO: string;
  slot: Slot;
  suggestedDeposit: number;
  rescheduleFrom?: string;
  keepDeposit: boolean;
}) {
  const [chargeDeposit, setChargeDeposit] = useState(false);
  const [amount, setAmount] = useState(suggestedDeposit);
  const [method, setMethod] = useState<Method>("cash");
  const [appointmentNote, setAppointmentNote] = useState("");

  return (
    <div className="space-y-3">
      <div className="divide-y divide-border rounded-inner bg-surface-container-low px-3">
        <SummaryRow icon="person" label="Cliente">
          {client.name}
        </SummaryRow>
        <SummaryRow icon="spa" label="Servicio">
          {service.name}
        </SummaryRow>
        <SummaryRow icon="badge" label="Profesional">
          {staff.id === "any" ? (
            "Cualquiera (el primero libre)"
          ) : (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar name={staff.name} src={staff.photoUrl} size="sm" className="h-5 w-5 text-[8px]" />
              <span className="truncate">{staff.name}</span>
            </span>
          )}
        </SummaryRow>
        <SummaryRow icon="event" label="Día y horario">
          {longDayLabel(dateISO)} · {slot.label}
        </SummaryRow>
        <SummaryRow icon="payments" label="Precio">
          <span className="tabular-nums">${service.price.toLocaleString("es-AR")}</span>
        </SummaryRow>
      </div>

      <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            checked={chargeDeposit}
            onChange={(e) => setChargeDeposit(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-primary"
          />
          Cobrar seña ahora
        </label>
        {chargeDeposit && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="block space-y-1">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Monto</span>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                max={service.price}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Math.min(service.price, Math.max(0, Number(e.target.value) || 0)))}
                className="w-32 tabular-nums"
              />
            </label>
            <div className="flex min-w-0 items-center gap-1 rounded-pill bg-surface-container p-1">
              <MethodButton active={method === "cash"} icon="payments" onClick={() => setMethod("cash")}>
                Efectivo
              </MethodButton>
              <MethodButton active={method === "transfer"} icon="account_balance" onClick={() => setMethod("transfer")}>
                Transferencia
              </MethodButton>
            </div>
          </div>
        )}
      </div>

      <label className="block space-y-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Nota del turno (opcional)</span>
        <textarea
          value={appointmentNote}
          onChange={(event) => setAppointmentNote(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Qué se va a realizar, color, diseño o detalle importante"
          className="w-full resize-y rounded-inner border border-border bg-surface px-3 py-2 font-body-lg text-body-lg text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary"
        />
      </label>

      <ConfirmSlotButton
        tenantSlug={tenantSlug}
        staffId={staff.id}
        clientId={client.id}
        serviceId={service.id}
        dateISO={dateISO}
        startsAtISO={slot.startsAtISO}
        rescheduleFrom={rescheduleFrom}
        keepDeposit={keepDeposit}
        depositAmount={chargeDeposit ? amount : 0}
        depositMethod={chargeDeposit ? method : undefined}
        appointmentNote={appointmentNote}
        label={rescheduleFrom ? "Confirmar reprogramación" : "Crear turno"}
      />
    </div>
  );
}

function MethodButton({
  active,
  icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 items-center gap-1 rounded-pill px-3 font-label-sm text-label-sm transition-colors duration-200",
        active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
      )}
    >
      <Icon name={icon} className="text-[14px]" />
      {children}
    </button>
  );
}
