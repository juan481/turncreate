"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ConfirmSlotButton } from "./confirm-slot-button";

type Slot = { startsAtISO: string; label: string };
type Method = "cash" | "mercadopago";

export function SlotsAndDeposit({
  tenantSlug,
  staffId,
  clientId,
  serviceId,
  dateISO,
  slots,
  suggestedDeposit,
  rescheduleFrom,
  keepDeposit,
}: {
  tenantSlug: string;
  staffId: string;
  clientId: string;
  serviceId: string;
  dateISO: string;
  slots: Slot[];
  suggestedDeposit: number;
  rescheduleFrom?: string;
  keepDeposit: boolean;
}) {
  const [chargeDeposit, setChargeDeposit] = useState(false);
  const [amount, setAmount] = useState(suggestedDeposit);
  const [method, setMethod] = useState<Method>("cash");

  return (
    <Card className="space-y-3 p-lg">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Horarios disponibles</h2>

      <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
        <label className="flex cursor-pointer items-center gap-2 font-label-md text-label-md text-on-surface">
          <input
            type="checkbox"
            checked={chargeDeposit}
            onChange={(e) => setChargeDeposit(e.target.checked)}
          />
          Cobrar seña ahora
        </label>
        {chargeDeposit && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">Monto</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                className="h-9 w-28"
              />
            </div>
            <div className="flex items-center gap-1 rounded-pill bg-surface-container p-1">
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={cn(
                  "flex items-center gap-1 rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all duration-200",
                  method === "cash" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                <Icon name="payments" className="text-[14px]" />
                Efectivo
              </button>
              <button
                type="button"
                onClick={() => setMethod("mercadopago")}
                className={cn(
                  "flex items-center gap-1 rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all duration-200",
                  method === "mercadopago" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
                )}
              >
                <Icon name="account_balance_wallet" className="text-[14px]" />
                Mercado Pago
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <ConfirmSlotButton
            key={slot.startsAtISO}
            tenantSlug={tenantSlug}
            staffId={staffId}
            clientId={clientId}
            serviceId={serviceId}
            dateISO={dateISO}
            startsAtISO={slot.startsAtISO}
            label={slot.label}
            rescheduleFrom={rescheduleFrom}
            keepDeposit={keepDeposit}
            depositAmount={chargeDeposit ? amount : 0}
            depositMethod={chargeDeposit ? method : undefined}
          />
        ))}
        {slots.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No hay horarios disponibles para esa combinación.
          </p>
        )}
      </div>
    </Card>
  );
}
