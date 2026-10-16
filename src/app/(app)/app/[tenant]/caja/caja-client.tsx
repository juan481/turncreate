"use client";

import { useActionState, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInTz, formatTimeInTz } from "@/lib/dates";
import { useToast } from "@/components/ui/toast";
import { confirmTransferAction } from "../transferencias/actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/ui/status-pill";
import { StatusDot } from "@/components/ui/status-dot";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiTile } from "@/components/ui/kpi-tile";
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
export type AppointmentDue = {
  id: string;
  startsAt: string;
  total: number;
  balance: number;
  /** Seña pedida (turnos que esperan transferencia). */
  depositDue?: number;
  clientName: string;
  staffName: string;
  serviceNames: string;
};
/** Turno detrás del "A devolver" de hoy (para abrirlo y marcar la seña devuelta). */
export type RefundDueItem = { id: string; clientName: string; href: string };
type Product = { id: string; name: string; price: number };
type Movement = { id: string; type: string; amount: number; reason: string; createdAt: string };
type LastClosedSession = {
  closedAt: string;
  expectedAmount: number;
  countedAmount: number;
  difference: number;
} | null;
/** Mismas definiciones que la home y Reportes (src/server/firebase/stats-model.ts). */
export type DayTotals = { cobrado: number; porCobrar: number; aDevolver: number; aDevolverCount: number; refundDue?: RefundDueItem[] };

const initialCajaState: CajaActionState = { error: null };
const initialChargeState: ChargeActionState = { error: null };

const METHOD_LABEL: Record<string, { label: string; icon: string }> = {
  cash: { label: "Efectivo", icon: "payments" },
  card_posnet: { label: "Posnet", icon: "credit_card" },
  transfer: { label: "Transferencia", icon: "swap_horiz" },
  mercadopago: { label: "Mercado Pago", icon: "account_balance_wallet" },
  other: { label: "Otros", icon: "payments" },
};

const SELECT_CLASS = "h-11 w-full min-w-0 rounded-pill border-0 bg-surface px-3 font-body-lg text-body-lg text-on-surface";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

/** Valor de KpiTile que nunca desborda: a 320px baja un tamaño y, en el peor caso, trunca (con el número completo en `title`). */
function MoneyValue({ amount, className }: { amount: number; className?: string }) {
  return (
    <span title={money(amount)} className={cn("block truncate text-headline-sm sm:text-headline-md", className)}>
      {money(amount)}
    </span>
  );
}

/** Encabezado chico para cada paso del flujo (Abrir → Cobrar → Cerrar), con el número en un círculo. */
function StepHeader({ step, title, hint }: { step?: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      {step !== undefined && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary font-label-sm text-label-sm text-on-primary">
          {step}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
        {hint && <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
      </div>
    </div>
  );
}

/** Cobrado hoy / Por cobrar hoy (+ "A devolver" si hay): los mismos números que la home. */
function DayTotalsTiles({ totals }: { totals: DayTotals }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-md">
        <KpiTile
          className="min-w-0"
          label="Cobrado hoy"
          icon={<Icon name="payments" className="text-[14px]" />}
          value={<MoneyValue amount={totals.cobrado} className="text-status-confirmed" />}
        />
        <KpiTile
          className="min-w-0"
          label="Por cobrar hoy"
          icon={<Icon name="pending_actions" className="text-[14px]" />}
          value={<MoneyValue amount={totals.porCobrar} className="text-secondary" />}
        />
      </div>
      {totals.aDevolver > 0 && (
        <div className="space-y-2 rounded-inner bg-status-alert-bg px-3 py-2.5 font-body-sm text-body-sm text-status-alert">
          <p className="flex min-w-0 items-start gap-2">
            <Icon name="warning" className="mt-0.5 shrink-0 text-[14px]" />
            <span className="min-w-0">
              <span className="tabular-nums">{money(totals.aDevolver)}</span> a devolver ({totals.aDevolverCount} seña
              {totals.aDevolverCount === 1 ? "" : "s"} de turnos cancelados). No suma en lo cobrado.
              {totals.refundDue && totals.refundDue.length > 0 && " Cuando la devuelvas, abrí el turno y tocá “Marcar seña devuelta”."}
            </span>
          </p>
          {totals.refundDue && totals.refundDue.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-[22px]">
              {totals.refundDue.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex h-11 max-w-full min-w-0 items-center gap-1 rounded-pill bg-surface px-3 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-muted"
                >
                  <span className="truncate">{item.clientName || "Ver turno"}</span>
                  <Icon name="chevron_right" className="shrink-0 text-[16px]" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpenCashForm({
  tenantSlug,
  appointments,
  timezone,
  lastClosedSession,
  totals,
}: {
  tenantSlug: string;
  appointments: AppointmentDue[];
  timezone: string;
  lastClosedSession: LastClosedSession;
  totals: DayTotals;
}) {
  const [state, formAction, pending] = useActionState(openCash.bind(null, tenantSlug), initialCajaState);

  return (
    <div className="mx-auto max-w-[36rem] space-y-lg">
      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
              <Icon name="point_of_sale" className="text-[18px]" />
            </span>
            <h2 className="min-w-0 font-headline-sm text-headline-sm text-on-surface [overflow-wrap:anywhere]">Caja del día</h2>
          </div>
          <StatusPill status="alert">Cerrada</StatusPill>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Abrí la caja para empezar el día.</p>
        <form action={formAction} className="space-y-md">
          <div className="space-y-xs">
            <label htmlFor="openingAmount" className="font-label-sm text-label-sm text-on-surface">
              Saldo inicial
            </label>
            <Input id="openingAmount" name="openingAmount" type="number" inputMode="decimal" placeholder="0.00" required min="0" step="0.01" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Abriendo…" : "Abrir caja"}
          </Button>
          {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
        </form>
      </Card>

      <DayTotalsTiles totals={totals} />

      {appointments.length > 0 && (
        <Card hoverLift={false} className="space-y-2 p-lg">
          <h3 className="font-label-lg text-label-lg text-on-surface">Te esperan hoy</h3>
          <div className="space-y-1">
            {appointments.slice(0, 4).map((a) => (
              <div key={a.id} className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <span className="w-12 shrink-0 tabular-nums text-on-surface">{formatTimeInTz(a.startsAt, timezone)}</span>
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
        <Card hoverLift={false} className="flex items-center justify-between gap-2 p-lg">
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface">Último cierre</p>
            <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
              {formatInTz(lastClosedSession.closedAt, timezone, { dateStyle: "short" })} · esperado{" "}
              <span className="tabular-nums">{money(lastClosedSession.expectedAmount)}</span>
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-pill px-3 py-1 font-label-sm text-label-sm tabular-nums",
              lastClosedSession.difference === 0
                ? "bg-status-confirmed-bg text-status-confirmed"
                : "bg-status-alert-bg text-status-alert",
            )}
          >
            {lastClosedSession.difference === 0 ? "Cuadró" : `Diferencia ${money(lastClosedSession.difference)}`}
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
  const fieldId = useId();

  return (
    <form action={formAction} className="space-y-3 rounded-inner bg-surface-container-low p-3">
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="amount" value={appointment.balance} />
      {product && (
        <>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="productQty" value={1} />
          <input type="hidden" name="productPrice" value={product.price} />
        </>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="min-w-0 space-y-1">
          <label htmlFor={`${fieldId}-method`} className="font-label-sm text-label-sm text-on-surface-variant">Método</label>
          <select id={`${fieldId}-method`} name="method" className={SELECT_CLASS}>
            <option value="cash">Efectivo</option>
            <option value="card_posnet">Posnet</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>
        {products.length > 0 && (
          <div className="min-w-0 space-y-1">
            <label htmlFor={`${fieldId}-product`} className="font-label-sm text-label-sm text-on-surface-variant">Agregar producto</label>
            <select id={`${fieldId}-product`} value={productId} onChange={(e) => setProductId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Ninguno</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {money(p.price)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-label-lg text-label-lg tabular-nums text-on-surface">Total a cobrar: {money(total)}</span>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1 sm:flex-none" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
            {pending ? "Cobrando…" : "Confirmar cobro"}
          </Button>
        </div>
      </div>
      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}

/** Fila de turno con saldo + botón Cobrar (que despliega el ChargeForm). Igual en Solo y con arqueo. */
function ChargeRow({
  appointment,
  timezone,
  tenantSlug,
  sessionId,
  products,
  charging,
  onCharge,
  onDone,
  showStaff,
  awaitingDeposit = false,
}: {
  appointment: AppointmentDue;
  timezone: string;
  tenantSlug: string;
  sessionId: string;
  products: Product[];
  charging: boolean;
  onCharge: () => void;
  onDone: () => void;
  showStaff: boolean;
  awaitingDeposit?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={appointment.clientName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-label-lg text-label-lg text-on-surface">
            <span className="tabular-nums">{formatTimeInTz(appointment.startsAt, timezone)}</span> · {appointment.clientName}
          </p>
          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
            {appointment.serviceNames}
            {showStaff && appointment.staffName ? ` · ${appointment.staffName}` : ""}
          </p>
          {awaitingDeposit && <StatusDot tone="pending">Esperando la seña</StatusDot>}
        </div>
        <span className="shrink-0 font-label-lg text-label-lg tabular-nums text-on-surface">{money(appointment.balance)}</span>
      </div>
      {charging ? (
        <ChargeForm tenantSlug={tenantSlug} sessionId={sessionId} appointment={appointment} products={products} onDone={onDone} />
      ) : (
        <Button className="w-full sm:w-auto" variant={awaitingDeposit ? "secondary" : "primary"} onClick={onCharge}>
          Cobrar
        </Button>
      )}
    </div>
  );
}

/**
 * Turno del turnero público que espera la seña por transferencia. No se
 * "cobra" acá (no falta el saldo, falta confirmar la seña): el botón usa el
 * mismo camino que /transferencias (confirmTransferDeposit), que registra la
 * seña exacta, confirma el turno y arma la ficha de la clienta.
 */
function TransferRow({ appointment, timezone, tenantSlug, showStaff }: { appointment: AppointmentDue; timezone: string; tenantSlug: string; showStaff: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const deposit = appointment.depositDue ?? 0;

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmTransferAction(tenantSlug, appointment.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.show(result.message);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={appointment.clientName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-label-lg text-label-lg text-on-surface">
            <span className="tabular-nums">{formatTimeInTz(appointment.startsAt, timezone)}</span> · {appointment.clientName}
          </p>
          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
            {appointment.serviceNames}
            {showStaff && appointment.staffName ? ` · ${appointment.staffName}` : ""}
          </p>
          <StatusDot tone="pending">Esperando transferencia</StatusDot>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-label-lg text-label-lg tabular-nums text-on-surface">{money(deposit)}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">seña</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="w-full sm:w-auto" disabled={pending} onClick={confirm}>
          <Icon name="check_circle" className="text-[18px]" />
          {pending ? "Confirmando…" : "Confirmar transferencia"}
        </Button>
        <Link
          href={`/app/${tenantSlug}/transferencias`}
          className="flex h-11 items-center justify-center rounded-pill px-3 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
        >
          Ver en Transferencias
        </Link>
      </div>
      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
    </div>
  );
}

/**
 * Lista de cobros del día. "Por cobrar" (confirmados/completados con saldo)
 * arriba; abajo, aparte, los que todavía esperan la seña (no suman en "Por
 * cobrar", pero si la clienta paga acá, el turno queda confirmado) y los que
 * esperan una transferencia (se confirman, no se cobran).
 */
function ChargeList({
  appointments,
  awaitingDeposit,
  awaitingTransfer,
  timezone,
  tenantSlug,
  sessionId,
  products,
  showStaff,
  emptyDescription,
}: {
  appointments: AppointmentDue[];
  awaitingDeposit: AppointmentDue[];
  awaitingTransfer: AppointmentDue[];
  timezone: string;
  tenantSlug: string;
  sessionId: string;
  products: Product[];
  showStaff: boolean;
  emptyDescription: string;
}) {
  const [chargingId, setChargingId] = useState<string | null>(null);
  const row = (appointment: AppointmentDue, isAwaiting: boolean) => (
    <ChargeRow
      key={appointment.id}
      appointment={appointment}
      timezone={timezone}
      tenantSlug={tenantSlug}
      sessionId={sessionId}
      products={products}
      showStaff={showStaff}
      awaitingDeposit={isAwaiting}
      charging={chargingId === appointment.id}
      onCharge={() => setChargingId(appointment.id)}
      onDone={() => setChargingId(null)}
    />
  );

  return (
    <Card hoverLift={false} className="space-y-3 p-lg">
      {appointments.map((appointment) => row(appointment, false))}
      {appointments.length === 0 && (
        <EmptyState
          className="py-6"
          icon={<Icon name="check_circle" className="text-[24px]" />}
          title="No tenés cobros pendientes"
          description={emptyDescription}
        />
      )}
      {awaitingDeposit.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="font-label-md text-label-md text-on-surface-variant">
            Esperan la seña · no suman en &quot;por cobrar&quot;
          </p>
          {awaitingDeposit.map((appointment) => row(appointment, true))}
        </div>
      )}
      {awaitingTransfer.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="font-label-md text-label-md text-on-surface-variant">
            Esperan la transferencia de la seña · confirmala cuando veas el comprobante
          </p>
          {awaitingTransfer.map((appointment) => (
            <TransferRow key={appointment.id} appointment={appointment} timezone={timezone} tenantSlug={tenantSlug} showStaff={showStaff} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AddMovementForm({ tenantSlug, sessionId, onDone }: { tenantSlug: string; sessionId: string; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(
    addCashMovement.bind(null, tenantSlug, sessionId),
    initialCajaState,
  );

  return (
    <form action={formAction} className="space-y-2 rounded-inner bg-surface-container-low p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr]">
        <select name="type" aria-label="Tipo de movimiento" className={SELECT_CLASS}>
          <option value="out">Retiro / gasto</option>
          <option value="in">Ingreso suelto</option>
        </select>
        <Input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="Monto" aria-label="Monto" required />
        <Input name="reason" placeholder="Motivo (ej: compra de insumos)" aria-label="Motivo" required />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Registrar"}
        </Button>
      </div>
      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}

function MethodGrid({ paymentsByMethod }: { paymentsByMethod: Record<string, number> }) {
  const methods = ["cash", "transfer", "card_posnet", "mercadopago", ...((paymentsByMethod.other ?? 0) > 0 ? ["other"] : [])];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {methods.map((method) => {
        const info = METHOD_LABEL[method];
        return (
          <div key={method} className="min-w-0 rounded-inner bg-surface-container-low p-3">
            <div className="flex min-w-0 items-center gap-1.5 text-on-surface-variant">
              <Icon name={info.icon} className="shrink-0 text-[15px]" />
              <span className="truncate font-label-sm text-label-sm">{info.label}</span>
            </div>
            <p className="mt-1 truncate font-label-lg text-label-lg tabular-nums text-on-surface">
              {money(paymentsByMethod[method] ?? 0)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function DirectCaja({
  tenantSlug,
  timezone,
  appointments,
  awaitingDeposit,
  awaitingTransfer,
  products,
  paymentsByMethod,
  totals,
}: {
  tenantSlug: string;
  timezone: string;
  appointments: AppointmentDue[];
  awaitingDeposit: AppointmentDue[];
  awaitingTransfer: AppointmentDue[];
  products: Product[];
  paymentsByMethod: Record<string, number>;
  totals: DayTotals;
}) {
  return (
    <div className="space-y-lg">
      <DayTotalsTiles totals={totals} />

      <Card hoverLift={false} className="space-y-3 p-lg">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Cobros de hoy</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Sin apertura ni cierre de caja: registrá cada cobro cuando lo recibís.</p>
        </div>
        <MethodGrid paymentsByMethod={paymentsByMethod} />
      </Card>

      <section className="space-y-sm">
        <StepHeader title="Cobros pendientes" hint="Tocá Cobrar cuando la clienta te paga." />
        <ChargeList
          appointments={appointments}
          awaitingDeposit={awaitingDeposit}
          awaitingTransfer={awaitingTransfer}
          timezone={timezone}
          tenantSlug={tenantSlug}
          sessionId=""
          products={products}
          showStaff={false}
          emptyDescription="Los saldos de los turnos de hoy van a aparecer acá."
        />
      </section>
    </div>
  );
}

export function CajaClient({
  cashSessionsEnabled,
  tenantSlug,
  timezone,
  session,
  appointments,
  awaitingDeposit,
  awaitingTransfer,
  products,
  movements,
  lastClosedSession,
  paymentsByMethod,
  totals,
}: {
  cashSessionsEnabled: boolean;
  tenantSlug: string;
  timezone: string;
  session: Session;
  appointments: AppointmentDue[];
  awaitingDeposit: AppointmentDue[];
  awaitingTransfer: AppointmentDue[];
  products: Product[];
  movements: Movement[];
  lastClosedSession: LastClosedSession;
  paymentsByMethod: Record<string, number>;
  totals: DayTotals;
}) {
  const [addingMovement, setAddingMovement] = useState(false);
  const [closeState, closeAction, closePending] = useActionState(
    closeCash.bind(null, tenantSlug, session?.id ?? ""),
    initialCajaState,
  );

  if (!cashSessionsEnabled) {
    return (
      <DirectCaja
        tenantSlug={tenantSlug}
        timezone={timezone}
        appointments={appointments}
        awaitingDeposit={awaitingDeposit}
        awaitingTransfer={awaitingTransfer}
        products={products}
        paymentsByMethod={paymentsByMethod}
        totals={totals}
      />
    );
  }

  if (!session) {
    return <OpenCashForm tenantSlug={tenantSlug} appointments={appointments} timezone={timezone} lastClosedSession={lastClosedSession} totals={totals} />;
  }

  const totalIn = movements.filter((m) => m.type === "in").reduce((sum, m) => sum + m.amount, 0);
  const totalOut = movements.filter((m) => m.type === "out").reduce((sum, m) => sum + m.amount, 0);
  const expected = session.opening_amount + totalIn - totalOut;
  const usedMethods = Object.entries(paymentsByMethod).filter(([, amount]) => amount > 0);

  return (
    <div className="space-y-lg">
      {/* El AppBar mobile ya muestra "Caja" + volver -- este título solo
          hace falta en el header-pill de desktop. */}
      <div className="hidden items-center justify-between lg:flex">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Caja</h1>
        <StatusPill status="confirmed">Abierta</StatusPill>
      </div>

      {/* Estado claro, arriba de todo: cuándo se abrió y cuánta plata hay
          en este momento. */}
      <Card hoverLift={false} className="flex items-center gap-3 p-lg">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-status-confirmed-bg text-status-confirmed">
          <Icon name="point_of_sale" className="text-[20px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-headline-sm text-headline-sm text-on-surface">
            Caja abierta desde <span className="tabular-nums">{formatTimeInTz(session.opened_at, timezone)}</span>
          </p>
          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
            Hay <span className="tabular-nums">{money(expected)}</span> en efectivo ahora mismo
          </p>
        </div>
      </Card>

      <DayTotalsTiles totals={totals} />

      {/* Arqueo: solo efectivo (apertura + entradas - salidas). */}
      <div className="grid grid-cols-2 gap-md md:grid-cols-4">
        <KpiTile className="min-w-0" label="Apertura" value={<MoneyValue amount={session.opening_amount} />} />
        <KpiTile className="min-w-0" label="Entradas" value={<MoneyValue amount={totalIn} className="text-status-confirmed" />} />
        <KpiTile className="min-w-0" label="Salidas" value={<MoneyValue amount={totalOut} className="text-status-alert" />} />
        <KpiTile
          className="min-w-0"
          label="Esperado"
          icon={<Icon name="payments" className="text-[14px]" />}
          value={<MoneyValue amount={expected} className="text-primary" />}
        />
      </div>

      {usedMethods.length > 0 && (
        <Card hoverLift={false} className="space-y-2 p-lg">
          <p className="font-label-md text-label-md text-on-surface-variant">Cobrado hoy por método</p>
          <div className="flex flex-wrap gap-2">
            {usedMethods.map(([method, amount]) => {
              const info = METHOD_LABEL[method] ?? { label: method, icon: "payments" };
              return (
                <span
                  key={method}
                  className="flex max-w-full min-w-0 items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface"
                >
                  <Icon name={info.icon} className="shrink-0 text-[14px] text-on-surface-variant" />
                  <span className="truncate">{info.label}:</span> <span className="shrink-0 tabular-nums">{money(amount)}</span>
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* Paso 2: cobrar los turnos de hoy. */}
      <section className="space-y-sm">
        <StepHeader step={2} title="Cobrar turnos de hoy" hint="Tocá Cobrar en cada turno cuando el cliente te paga." />
        <ChargeList
          appointments={appointments}
          awaitingDeposit={awaitingDeposit}
          awaitingTransfer={awaitingTransfer}
          timezone={timezone}
          tenantSlug={tenantSlug}
          sessionId={session.id}
          products={products}
          showStaff
          emptyDescription="Los turnos confirmados de hoy van a aparecer acá para que los cobres apenas el cliente pague."
        />
      </section>

      <Card hoverLift={false} className="space-y-3 p-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Movimientos de caja</h2>
          {!addingMovement && (
            <Button variant="secondary" onClick={() => setAddingMovement(true)}>
              <Icon name="add" className="text-[16px]" />
              Movimiento suelto
            </Button>
          )}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Entradas y salidas de efectivo que no son el cobro de un turno (retiros, gastos, ingresos sueltos).
        </p>
        {addingMovement && (
          <AddMovementForm tenantSlug={tenantSlug} sessionId={session.id} onDone={() => setAddingMovement(false)} />
        )}
        <div className="divide-y divide-border">
          {movements.map((m) => (
            <div key={m.id} className="flex min-w-0 items-center gap-3 py-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  m.type === "in" ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-alert-bg text-status-alert",
                )}
              >
                <Icon name={m.type === "in" ? "add" : "trending_down"} className="text-[16px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-md text-label-md text-on-surface">{m.reason}</p>
                <p className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">{formatTimeInTz(m.createdAt, timezone)}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 font-label-md text-label-md tabular-nums",
                  m.type === "in" ? "text-status-confirmed" : "text-status-alert",
                )}
              >
                {m.type === "in" ? "+" : "-"}{money(m.amount)}
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

      {/* Paso 3: cerrar caja (arqueo). */}
      <section className="space-y-sm">
        <StepHeader
          step={3}
          title="Cerrar caja"
          hint="Contá el efectivo que tenés en la mano y compáralo con lo que el sistema esperaba -- eso es el arqueo."
        />
        <Card hoverLift={false} className="space-y-3 p-lg">
          <form action={closeAction} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <label htmlFor="countedAmount" className="font-label-sm text-label-sm text-on-surface-variant">Efectivo contado</label>
                <Input id="countedAmount" name="countedAmount" type="number" inputMode="decimal" min="0" step="0.01" required />
              </div>
              <div className="min-w-0 space-y-1">
                <label htmlFor="differenceReason" className="font-label-sm text-label-sm text-on-surface-variant">
                  Motivo (si hay diferencia)
                </label>
                <Input id="differenceReason" name="differenceReason" placeholder="Vuelto de más, error de conteo..." />
              </div>
            </div>
            <Button type="submit" variant="secondary" disabled={closePending}>
              {closePending ? "Cerrando…" : "Cerrar caja"}
            </Button>
            {closeState.error && (
              <p role="alert" className="font-body-sm text-body-sm text-status-alert">{closeState.error}</p>
            )}
          </form>
        </Card>
      </section>
    </div>
  );
}
