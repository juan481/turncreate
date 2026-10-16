import type { ReactNode } from "react";
import Link from "next/link";
import { Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getPayments, getRefundDueAppointmentIds } from "@/server/firebase/stats";
import { dailyPaymentHistory, PAYMENT_METHODS, type PaymentBreakdown } from "@/server/firebase/stats-model";
import { addDaysISO, dayRange, formatTimeInTz, isDateISO, longDayLabel, toDateISOInTz, todayISO } from "@/lib/dates";
import { planFeatures } from "@/lib/plans";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CajaTabs } from "../caja-tabs";

/** Cierres por página (Equipo/Pro). */
const SESSIONS_PAGE = 20;
/** Días por página (Solo). */
const DAYS_PAGE = 14;
/** Hasta dónde se puede ir para atrás día por día (Solo); más allá, Reportes por mes. */
const MAX_LOOKBACK_DAYS = 365;

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  card_posnet: "Posnet",
  mercadopago: "Mercado Pago",
  other: "Otros",
};

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function PagerLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:w-auto")}>
      {children}
    </Link>
  );
}

// Fuera del componente: el linter de React marca `Date.now()` adentro del render.
function latestCutoffMs() {
  return Date.now() + 24 * 60 * 60_000;
}

type SearchParams = { antes?: string | string[]; hasta?: string | string[] };

export default async function CajaHistorialPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const sp = await searchParams;
  const features = planFeatures(tenant);

  return (
    <div className="space-y-lg">
      <CajaTabs tenantSlug={tenantSlug} active="historial" />
      <h1 className="hidden font-headline-lg text-headline-lg text-on-surface lg:block">Historial de caja</h1>
      {features.cashSessions ? (
        <ClosedSessions tenantId={tenant.id} tenantSlug={tenantSlug} timezone={tenant.timezone} antes={sp.antes} />
      ) : (
        <DailyPayments tenantId={tenant.id} tenantSlug={tenantSlug} timezone={tenant.timezone} hasta={sp.hasta} />
      )}
    </div>
  );
}

/* --------------------------- Equipo / Pro --------------------------- */

async function ClosedSessions({ tenantId, tenantSlug, timezone, antes }: { tenantId: string; tenantSlug: string; timezone: string; antes?: string | string[] }) {
  const beforeMs = typeof antes === "string" && /^\d{10,14}$/.test(antes) ? Number(antes) : null;
  // Rango sobre `closedAt` (+ orden por el mismo campo = índice automático):
  // solo trae cerradas (el `null` de la abierta no entra en un rango de
  // timestamps) y como mucho una página + 1 para saber si hay más.
  const snapshot = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("cashSessions")
    .where("closedAt", "<", Timestamp.fromMillis(beforeMs ?? latestCutoffMs()))
    .orderBy("closedAt", "desc")
    .limit(SESSIONS_PAGE + 1)
    .select("openedAt", "closedAt", "openingAmount", "expectedAmount", "countedAmount", "difference", "differenceReason")
    .get();

  const sessions = snapshot.docs.slice(0, SESSIONS_PAGE).map((doc) => {
    const data = doc.data();
    const closedAt: Date = data.closedAt.toDate();
    return {
      id: doc.id,
      openedAt: data.openedAt?.toDate?.() as Date | undefined,
      closedAt,
      opening: Number(data.openingAmount ?? 0),
      expected: Number(data.expectedAmount ?? 0),
      counted: Number(data.countedAmount ?? 0),
      difference: Number(data.difference ?? 0),
      reason: typeof data.differenceReason === "string" ? data.differenceReason : "",
    };
  });
  const hasMore = snapshot.docs.length > SESSIONS_PAGE;
  const last = sessions[sessions.length - 1];

  if (sessions.length === 0) {
    return (
      <Card hoverLift={false} className="p-lg">
        <EmptyState
          icon={<Icon name="history" className="text-[24px]" />}
          title={beforeMs ? "No hay cierres más viejos" : "Todavía no cerraste ninguna caja"}
          description="Cada vez que cerrás la caja, el arqueo queda guardado acá."
        />
      </Card>
    );
  }

  return (
    <section className="space-y-sm" aria-labelledby="cierres-titulo">
      <div className="min-w-0">
        <h2 id="cierres-titulo" className="font-headline-sm text-headline-sm text-on-surface">Cierres de caja</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Lo que esperaba el sistema y lo que contaste en cada cierre.</p>
      </div>
      <ul className="space-y-2">
        {sessions.map((session) => (
          <li key={session.id}>
            <Card hoverLift={false} className="space-y-3 p-lg">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-label-lg text-label-lg text-on-surface">
                    {longDayLabel(toDateISOInTz(session.closedAt, timezone))}
                  </p>
                  <p className="font-body-sm text-body-sm tabular-nums text-on-surface-variant">
                    {session.openedAt ? `${formatTimeInTz(session.openedAt, timezone)} – ` : "Cerró "}
                    {formatTimeInTz(session.closedAt, timezone)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-pill px-3 py-1 font-label-sm text-label-sm tabular-nums",
                    session.difference === 0 ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-alert-bg text-status-alert",
                  )}
                >
                  {session.difference === 0 ? "Cuadró" : `${session.difference > 0 ? "+" : "-"}${money(Math.abs(session.difference))}`}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2">
                {[
                  { label: "Apertura", value: session.opening },
                  { label: "Esperado", value: session.expected },
                  { label: "Contado", value: session.counted },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-inner bg-surface-container-low p-2.5">
                    <dt className="truncate font-label-sm text-label-sm text-on-surface-variant">{item.label}</dt>
                    <dd className="truncate font-label-lg text-label-lg tabular-nums text-on-surface" title={money(item.value)}>{money(item.value)}</dd>
                  </div>
                ))}
              </dl>
              {session.reason && (
                <p className="truncate font-body-sm text-body-sm text-on-surface-variant">Motivo: {session.reason}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {beforeMs && <PagerLink href={`/app/${tenantSlug}/caja/historial`}>Volver a los más recientes</PagerLink>}
        {hasMore && last && (
          <PagerLink href={`/app/${tenantSlug}/caja/historial?antes=${last.closedAt.getTime()}`}>
            Ver cierres anteriores
            <Icon name="chevron_right" className="text-[16px]" />
          </PagerLink>
        )}
      </div>
    </section>
  );
}

/* ------------------------------- Solo ------------------------------- */

function DayRow({ dateISO, breakdown }: { dateISO: string; breakdown: PaymentBreakdown }) {
  const methods = [...PAYMENT_METHODS, "other" as const].filter((method) => breakdown.byMethod[method].count > 0);
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-label-lg text-label-lg text-on-surface">{longDayLabel(dateISO)}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {breakdown.count} cobro{breakdown.count === 1 ? "" : "s"}
          </p>
        </div>
        <span className="shrink-0 font-headline-sm text-headline-sm tabular-nums text-status-confirmed">{money(breakdown.gross)}</span>
      </div>
      {methods.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {methods.map((method) => (
            <span
              key={method}
              className="flex max-w-full min-w-0 items-center gap-1 rounded-pill bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface"
            >
              <span className="truncate">{METHOD_LABEL[method]}</span>
              <span className="shrink-0 tabular-nums">{money(breakdown.byMethod[method].gross)}</span>
            </span>
          ))}
        </div>
      )}
      {breakdown.refundDue.count > 0 && (
        <p className="font-body-sm text-body-sm text-status-alert">
          <span className="tabular-nums">{money(breakdown.refundDue.gross)}</span> a devolver (seña de turno cancelado)
        </p>
      )}
    </li>
  );
}

async function DailyPayments({ tenantId, tenantSlug, timezone, hasta }: { tenantId: string; tenantSlug: string; timezone: string; hasta?: string | string[] }) {
  const today = todayISO(timezone);
  const oldest = addDaysISO(today, -MAX_LOOKBACK_DAYS);
  const endISO = typeof hasta === "string" && isDateISO(hasta) && hasta <= today ? (hasta < oldest ? oldest : hasta) : today;
  const startISO = addDaysISO(endISO, -(DAYS_PAGE - 1));
  const range = { start: dayRange(startISO, timezone).start, end: dayRange(endISO, timezone).end };
  const [payments, refundDueIds] = await Promise.all([getPayments(tenantId, range), getRefundDueAppointmentIds(tenantId)]);
  const days = dailyPaymentHistory(payments, timezone, refundDueIds);
  const windowTotal = days.reduce((sum, day) => sum + day.breakdown.gross, 0);
  const canGoBack = startISO > oldest;

  return (
    <section className="space-y-sm" aria-labelledby="dias-titulo">
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="dias-titulo" className="font-headline-sm text-headline-sm text-on-surface">Cobros día por día</h2>
          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
            Del {longDayLabel(startISO, { capital: false })} al {longDayLabel(endISO, { capital: false })}
          </p>
        </div>
        <span className="shrink-0 font-label-lg text-label-lg tabular-nums text-on-surface">{money(windowTotal)}</span>
      </div>
      <Card hoverLift={false} className="p-lg">
        {days.length === 0 ? (
          <EmptyState
            className="py-6"
            icon={<Icon name="receipt" className="text-[24px]" />}
            title="No hubo cobros en estos días"
            description="Cada cobro que registres (en caja, en el turno o por Mercado Pago) aparece acá, en el día que entró la plata."
          />
        ) : (
          <ul className="divide-y divide-border">
            {days.map((day) => (
              <DayRow key={day.dateISO} dateISO={day.dateISO} breakdown={day.breakdown} />
            ))}
          </ul>
        )}
      </Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {endISO !== today && <PagerLink href={`/app/${tenantSlug}/caja/historial`}>Volver a hoy</PagerLink>}
        {canGoBack && (
          <PagerLink href={`/app/${tenantSlug}/caja/historial?hasta=${addDaysISO(startISO, -1)}`}>
            Ver días anteriores
            <Icon name="chevron_right" className="text-[16px]" />
          </PagerLink>
        )}
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        ¿Querés ver el mes entero?{" "}
        <Link href={`/app/${tenantSlug}/reportes`} className="font-label-md text-label-md text-secondary underline-offset-2 hover:underline">
          Andá a Reportes
        </Link>
        .
      </p>
    </section>
  );
}
