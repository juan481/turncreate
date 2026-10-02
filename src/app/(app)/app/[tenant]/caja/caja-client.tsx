"use client";

import { useActionState, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import {
  openCash,
  closeCash,
  chargeAppointment,
  addCashMovement,
  type CajaActionState,
  type ChargeActionState,
} from "./actions";

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
type Movement = { id: string; type: string; amount: number; reason: string; createdAt: string };
type LastClosedSession = {
  closedAt: string;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
} | null;

const initialCajaState: CajaActionState = { error: null };
const initialChargeState: ChargeActionState = { error: null };

const METHOD_LABEL: Record<string, { label: string; icon: string }> = {
  cash: { label: "Efectivo", icon: "payments" },
  card_posnet: { label: "Posnet", icon: "credit_card" },
  transfer: { label: "Transferencia", icon: "swap_horiz" },
  mercadopago: { label: "Mercado Pago", icon: "account_balance_wallet" },
};

function formatHour(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

function OpenCashForm({
  tenantSlug,
  appointments,
  timezone,
  lastClosedSession,
}: {
  tenantSlug: string;
  appointments: AppointmentDue[];
  timezone: string;
  lastClosedSession: LastClosedSession;
}) {
  const [state, formAction, pending] = useActionState(openCash.bind(null, tenantSlug), initialCajaState);
  const pendingTotal = appointments.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="mx-auto max-w-[36rem] space-y-lg">
      <Card className="space-y-md p-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
              <Icon name="point_of_sale" className="text-[18px]" />
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Estado de caja</h2>
          </div>
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

      {appointments.length > 0 && (
        <Card hoverLift={false} className="space-y-2 p-lg">
          <div className="flex items-center justify-between">
            <h3 className="font-label-lg text-label-lg text-on-surface">Te esperan hoy</h3>
            <span className="rounded-pill bg-secondary-soft px-3 py-0.5 font-label-sm text-label-sm text-secondary">
              ${pendingTotal.toLocaleString("es-AR")} por cobrar
            </span>
          </div>
          <div className="space-y-1">
            {appointments.slice(0, 4).map((a) => (
              <div key={a.id} className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <span className="w-12 shrink-0 text-on-surface">{formatHour(a.startsAt, timezone)}</span>
                <span className="truncate">{a.clientName} · {a.serviceNames}</span>
              </div>
            ))}
            {appointments.length > 4 && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                + {appointments.length - 4} turno{appointments.length - 4 === 1 ? "" : "s"} más
              </p>
            )}
          </div>
        </Card>
      )}

      {lastClosedSession && (
        <Card hoverLift={false} className="flex items-center justify-between p-lg">
          <div>
            <p className="font-label-md text-label-md text-on-surface">Último cierre</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {new Date(lastClosedSession.closedAt).toLocaleDateString("es-AR")} · esperado $
              {lastClosedSession.expectedAmount.toLocaleString("es-AR")}
            </p>
          </div>
          <span
            className={cn(
              "rounded-pill px-3 py-1 font-label-sm text-label-sm",
              lastClosedSession.difference === 0
                ? "bg-status-confirmed-bg text-status-confirmed"
                : "bg-status-alert-bg text-status-alert",
            )}
          >
            {lastClosedSession.difference === 0
              ? "Cuadró"
              : `Diferencia $${lastClosedSession.difference.toLocaleString("es-AR")}`}
          </span>
        </Card>
      )}
    </div>
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
    <form action={formAction} className="space-y-3 rounded-inner bg-surface-container-low p-3">
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

function AddMovementForm({ tenantSlug, sessionId, onDone }: { tenantSlug: string; sessionId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    addCashMovement.bind(null, tenantSlug, sessionId),
    initialCajaState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-inner bg-surface-container-low p-3">
      <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]">
        <select
          name="type"
          className="h-9 rounded-pill border-0 bg-surface px-3 font-body-sm text-body-sm text-on-surface"
        >
          <option value="out">Retiro / gasto</option>
          <option value="in">Ingreso suelto</option>
        </select>
        <Input name="amount" type="number" min="0.01" step="0.01" placeholder="Monto" required className="h-9" />
        <Input name="reason" placeholder="Motivo (ej: compra de insumos)" required className="h-9" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Registrar"}
        </Button>
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
  lastClosedSession,
  paymentsByMethod,
}: {
  tenantSlug: string;
  timezone: string;
  session: Session;
  appointments: AppointmentDue[];
  products: Product[];
  movements: Movement[];
  lastClosedSession: LastClosedSession;
  paymentsByMethod: Record<string, number>;
}) {
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [addingMovement, setAddingMovement] = useState(false);
  const [closeState, closeAction, closePending] = useActionState(
    session ? closeCash.bind(null, tenantSlug, session.id) : closeCash.bind(null, tenantSlug, ""),
    initialCajaState,
  );

  if (!session) {
    return <OpenCashForm tenantSlug={tenantSlug} appointments={appointments} timezone={timezone} lastClosedSession={lastClosedSession} />;
  }

  const totalIn = movements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.amount, 0);
  const expected = session.opening_amount + totalIn - totalOut;

  return (
    <div className="space-y-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
            Caja
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Abierta a las {formatHour(session.opened_at, timezone)}
          </p>
        </div>
        <StatusPill status="confirmed">Abierta</StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-md md:grid-cols-4">
        <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Apertura</p>
          <p className="font-headline-sm text-headline-sm text-on-surface">
            ${session.opening_amount.toLocaleString("es-AR")}
          </p>
        </Card>
        <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Entradas</p>
          <p className="font-headline-sm text-headline-sm text-status-confirmed">
            +${totalIn.toLocaleString("es-AR")}
          </p>
        </Card>
        <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
          <p className="font-label-sm text-label-sm text-on-surface-variant">Salidas</p>
          <p className="font-headline-sm text-headline-sm text-status-alert">
            -${totalOut.toLocaleString("es-AR")}
          </p>
        </Card>
        <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
          <p className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="payments" className="text-[14px]" />
            Esperado
          </p>
          <p className="font-headline-sm text-headline-sm text-primary">${expected.toLocaleString("es-AR")}</p>
        </Card>
      </div>

      {Object.keys(paymentsByMethod).length > 0 && (
        <Card hoverLift={false} className="space-y-2 p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Cobrado hoy por método</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(paymentsByMethod).map(([method, amount]) => {
              const info = METHOD_LABEL[method] ?? { label: method, icon: "payments" };
              return (
                <span
                  key={method}
                  className="flex items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface"
                >
                  <Icon name={info.icon} className="text-[14px] text-on-surface-variant" />
                  {info.label}: ${amount.toLocaleString("es-AR")}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      <Card hoverLift={false} className="space-y-3 p-lg">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Turnos confirmados de hoy</h2>
        {appointments.map((appointment) => (
          <div key={appointment.id} className="space-y-2 rounded-inner bg-surface-container-low p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Avatar name={appointment.clientName} size="sm" />
                <div>
                  <p className="font-label-md text-label-md text-on-surface">
                    {formatHour(appointment.startsAt, timezone)} · {appointment.clientName}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {appointment.serviceNames} · {appointment.staffName}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
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

      <Card hoverLift={false} className="space-y-3 p-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Movimientos de caja</h2>
          {!addingMovement && (
            <Button variant="secondary" size="sm" onClick={() => setAddingMovement(true)}>
              <Icon name="add" className="text-[16px]" />
              Movimiento suelto
            </Button>
          )}
        </div>
        {addingMovement && (
          <AddMovementForm tenantSlug={tenantSlug} sessionId={session.id} onDone={() => setAddingMovement(false)} />
        )}
        <div className="divide-y divide-border">
          {movements.map((m) => (
            <div key={m.id} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  m.type === "in" ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-alert-bg text-status-alert",
                )}
              >
                <Icon name={m.type === "in" ? "add" : "remove"} className="text-[16px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-md text-label-md text-on-surface">{m.reason}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {formatHour(m.createdAt, timezone)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-label-md text-label-md",
                  m.type === "in" ? "text-status-confirmed" : "text-status-alert",
                )}
              >
                {m.type === "in" ? "+" : "-"}${m.amount.toLocaleString("es-AR")}
              </span>
            </div>
          ))}
          {movements.length === 0 && (
            <p className="py-3 text-center font-body-sm text-body-sm text-on-surface-variant">
              Todavía no hay movimientos en esta caja.
            </p>
          )}
        </div>
      </Card>

      <Card hoverLift={false} className="space-y-3 p-lg">
        <h2 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
          <Icon name="lock" className="text-[18px] text-on-surface-variant" />
          Cerrar caja (arqueo)
        </h2>
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
