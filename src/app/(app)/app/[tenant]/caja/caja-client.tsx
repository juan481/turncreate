"use client";

import { useActionState, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { openCash, closeCash, chargeAppointment, type CajaActionState, type ChargeActionState } from "./actions";

type Session = { id: string; opened_at: string; opening_amount: number } | null;
type AppointmentDue = {
  id: string;
  startsAt: string;
  total: number;
  balance: number;
  clientName: string;
  staffName: string;
  serviceNames: string;
};
type Product = { id: string; name: string; price: number };
type Movement = { id: string; type: string; amount: number; reason: string };

const initialCajaState: CajaActionState = { error: null };
const initialChargeState: ChargeActionState = { error: null };

function formatHour(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

function OpenCashForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(openCash.bind(null, tenantSlug), initialCajaState);

  return (
    <Card className="mx-auto mt-xl max-w-[28rem] space-y-md p-lg">
      <div className="flex items-center justify-between">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Estado de caja</h2>
        <StatusPill status="alert">Cerrada</StatusPill>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        La caja está cerrada. Abrila para empezar a cobrar.
      </p>
      <form action={formAction} className="space-y-md">
        <div className="space-y-xs">
          <label htmlFor="openingAmount" className="font-label-sm text-label-sm text-on-surface">
            Saldo inicial
          </label>
          <Input id="openingAmount" name="openingAmount" type="number" placeholder="0.00" required min="0" step="0.01" />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Abriendo…" : "Abrir caja"}
        </Button>
        {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      </form>
    </Card>
  );
}

function ChargeForm({
  tenantSlug,
  sessionId,
  appointment,
  products,
  onDone,
}: {
  tenantSlug: string;
  sessionId: string;
  appointment: AppointmentDue;
  products: Product[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    chargeAppointment.bind(null, tenantSlug),
    initialChargeState,
  );
  const [productId, setProductId] = useState("");
  const product = products.find((p) => p.id === productId);
  const total = appointment.balance + (product?.price ?? 0);

  return (
    <form action={formAction} className="space-y-3 rounded-inner bg-surface-muted p-3">
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="amount" value={total} />
      {product && (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="productQty" value={1} />
          <input type="hidden" name="productPrice" value={product.price} />
        </>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Método</label>
          <select
            name="method"
            className="h-9 w-full rounded-pill border-0 bg-surface px-3 font-body-sm text-body-sm text-on-surface"
          >
            <option value="cash">Efectivo</option>
            <option value="card_posnet">Posnet</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="font-label-sm text-label-sm text-on-surface-variant">Agregar producto</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-9 w-full rounded-pill border-0 bg-surface px-3 font-body-sm text-body-sm text-on-surface"
          >
            <option value="">Ninguno</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · ${p.price.toLocaleString("es-AR")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-label-md text-label-md text-on-surface">
          Total a cobrar: ${total.toLocaleString("es-AR")}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Cobrando…" : "Confirmar cobro"}
          </Button>
        </div>
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}

export function CajaClient({
  tenantSlug,
  timezone,
  session,
  appointments,
  products,
  movements,
}: {
  tenantSlug: string;
  timezone: string;
  session: Session;
  appointments: AppointmentDue[];
  products: Product[];
  movements: Movement[];
}) {
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [closeState, closeAction, closePending] = useActionState(
    session ? closeCash.bind(null, tenantSlug, session.id) : closeCash.bind(null, tenantSlug, ""),
    initialCajaState,
  );

  if (!session) {
    return <OpenCashForm tenantSlug={tenantSlug} />;
  }

  const totalIn = movements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.amount, 0);
  const expected = session.opening_amount + totalIn - totalOut;

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Caja</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Abierta a las {formatHour(session.opened_at, timezone)}
          </p>
        </div>
        <StatusPill status="confirmed">Abierta</StatusPill>
      </div>

      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Card className="flex flex-col gap-xs p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Efectivo esperado en caja</p>
          <p className="font-headline-lg-mobile text-headline-lg-mobile text-primary">
            ${expected.toLocaleString("es-AR")}
          </p>
        </Card>
      </div>

      <Card className="space-y-3 p-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Turnos confirmados de hoy</h2>
        {appointments.map((appointment) => (
          <div key={appointment.id} className="space-y-2 rounded-inner bg-surface-muted p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-label-md text-label-md text-on-surface">
                  {formatHour(appointment.startsAt, timezone)} · {appointment.clientName}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {appointment.serviceNames} · {appointment.staffName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-label-md text-label-md text-on-surface">
                  ${appointment.balance.toLocaleString("es-AR")}
                </span>
                {chargingId !== appointment.id && (
                  <Button size="sm" onClick={() => setChargingId(appointment.id)}>
                    Cobrar
                  </Button>
                )}
              </div>
            </div>
            {chargingId === appointment.id && (
              <ChargeForm
                tenantSlug={tenantSlug}
                sessionId={session.id}
                appointment={appointment}
                products={products}
                onDone={() => setChargingId(null)}
              />
            )}
          </div>
        ))}
        {appointments.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No hay turnos confirmados pendientes de cobro hoy.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Cerrar caja (arqueo)</h2>
        <form action={closeAction} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">Efectivo contado</label>
              <Input name="countedAmount" type="number" min="0" step="0.01" required />
            </div>
            <div className="space-y-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant">
                Motivo (si hay diferencia)
              </label>
              <Input name="differenceReason" placeholder="Vuelto de más, error de conteo..." />
            </div>
          </div>
          <Button type="submit" variant="secondary" disabled={closePending}>
            {closePending ? "Cerrando…" : "Cerrar caja"}
          </Button>
          {closeState.error && (
            <p className="font-body-sm text-body-sm text-status-alert">{closeState.error}</p>
          )}
        </form>
      </Card>
    </div>
  );
}
