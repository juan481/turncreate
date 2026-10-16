import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { KpiTile } from "@/components/ui/kpi-tile";
import { VerticalBarChart } from "@/components/ui/bar-chart";
import { cn } from "@/lib/utils";
import type { AnalyticsRange } from "@/server/analytics/types";
import { evolutionSeries, type ReportesData } from "./data";
import { ServicesCard } from "./ReportesClient";

/*
 * Secciones de Reportes como Server Components async: cada una espera solo
 * las promesas que necesita (data.ts) y se streamea en su propio
 * <Suspense> (page.tsx). Colores siempre con tokens de globals.css.
 */

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

/** Valor de KpiTile que no desborda a 320px: un tamaño menos en mobile y truncate con el valor completo en `title`. */
function KpiValue({ children, title, className }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <span title={title} className={cn("block truncate text-headline-sm sm:text-headline-md", className)}>
      {children}
    </span>
  );
}

function MoneyKpi({
  label,
  icon,
  iconClassName,
  amount,
  valueClassName,
  hint,
}: {
  label: string;
  icon: string;
  iconClassName: string;
  amount: number;
  valueClassName?: string;
  hint?: ReactNode;
}) {
  return (
    <KpiTile
      className="min-w-0"
      label={label}
      icon={<Icon name={icon} className={cn("text-[14px]", iconClassName)} />}
      value={<KpiValue title={money(amount)} className={valueClassName}>{money(amount)}</KpiValue>}
      hint={hint}
    />
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="font-label-lg text-label-lg text-on-surface-variant">{children}</h2>;
}

/** Grillas de KPIs: 2 columnas desde 320px (con `min-w-0` en cada tile), 4 en desktop. */
const KPI_GRID = "grid grid-cols-2 gap-md lg:grid-cols-4";

export async function ClientKpis({ data }: { data: ReportesData }) {
  const [current, evolution, newClients] = await Promise.all([data.current, data.evolution, data.newClients]);
  const currentClients = new Set(current.completed.clientIds);
  const didNotReturn = [...evolution.previousMonthClientIds].filter((id) => !currentClients.has(id)).length;

  const tiles = [
    { label: "Turnos", value: current.completed.count, hint: "realizados", icon: "event_available", tone: "text-status-confirmed" },
    { label: "Clientes", value: currentClients.size, hint: "atendidos", icon: "group", tone: "text-primary" },
    { label: "Nuevos", value: newClients, hint: "clientes dados de alta", icon: "person_add", tone: "text-secondary" },
    { label: "No volvieron", value: didNotReturn, hint: "vinieron el mes anterior", icon: "person_off", tone: "text-status-alert" },
  ];

  return (
    <section className="space-y-2" aria-label="Clientes del mes">
      <SectionTitle>Clientes</SectionTitle>
      <div className={KPI_GRID}>
        {tiles.map((tile) => (
          <KpiTile
            key={tile.label}
            className="min-w-0"
            label={tile.label}
            icon={<Icon name={tile.icon} className={cn("text-[14px]", tile.tone)} />}
            value={<KpiValue>{tile.value}</KpiValue>}
            hint={tile.hint}
          />
        ))}
      </div>
    </section>
  );
}

export async function MoneyKpis({ data }: { data: ReportesData }) {
  const [current, payments, egresos] = await Promise.all([data.current, data.payments, data.egresos]);
  const result = payments.net - egresos;

  return (
    <section className="space-y-2" aria-label="Plata del mes">
      <SectionTitle>Plata</SectionTitle>
      <div className={KPI_GRID}>
        <MoneyKpi label="Facturado" icon="receipt_long" iconClassName="text-primary" amount={current.completed.income} hint="servicios completados" />
        <MoneyKpi
          label="Cobrado"
          icon="payments"
          iconClassName="text-status-confirmed"
          amount={payments.gross}
          hint={payments.surcharges > 0 ? `incluye ${money(payments.surcharges)} de recargos` : "pagos recibidos"}
        />
        <MoneyKpi
          label="Costos MP"
          icon="account_balance_wallet"
          iconClassName="text-status-draft"
          amount={payments.fees}
          hint={payments.feeUnknownCount > 0 ? `${payments.feeUnknownCount} cobro${payments.feeUnknownCount === 1 ? "" : "s"} sin detalle de comisión` : "comisión de Mercado Pago"}
        />
        <MoneyKpi label="Neto" icon="savings" iconClassName="text-secondary" amount={payments.net} hint="lo que te quedó" />
        <MoneyKpi label="Por cobrar" icon="pending_actions" iconClassName="text-status-draft" amount={current.totals.porCobrar} hint="saldos de turnos del mes" />
        {payments.refundDue.count > 0 && (
          <MoneyKpi
            label="A devolver"
            icon="warning"
            iconClassName="text-status-alert"
            amount={payments.refundDue.gross}
            valueClassName="text-status-alert"
            hint={`${payments.refundDue.count} seña${payments.refundDue.count === 1 ? "" : "s"} de cancelados, fuera del neto`}
          />
        )}
        <MoneyKpi label="Egresos" icon="trending_down" iconClassName="text-status-alert" amount={egresos} hint="salidas de caja" />
        <MoneyKpi
          label="Resultado"
          icon="account_balance"
          iconClassName={result >= 0 ? "text-status-confirmed" : "text-status-alert"}
          amount={result}
          valueClassName={result >= 0 ? undefined : "text-status-alert"}
          hint="neto menos egresos"
        />
      </div>
    </section>
  );
}

function PublicBookingAnalytics({ analytics }: { analytics: AnalyticsRange }) {
  const { totals } = analytics;
  const funnel = [
    { label: "Visitas", value: totals.views, color: "bg-primary" },
    { label: "Reservas iniciadas", value: totals.bookingStarted, color: "bg-primary-light" },
    { label: "Checkout iniciado", value: totals.checkoutStarted, color: "bg-primary-glow" },
    { label: "Pagos aprobados", value: totals.paymentApproved, color: "bg-status-confirmed-dot" },
    { label: "Turnos confirmados", value: totals.appointmentConfirmed, color: "bg-tertiary" },
  ];
  const maxFunnel = Math.max(...funnel.map((item) => item.value), 1);
  const maxDailyViews = Math.max(...analytics.days.map((day) => day.views), 1);

  return (
    <Card hoverLift={false} className="space-y-lg p-lg">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
          <Icon name="ads_click" className="text-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Actividad del turnero</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Embudo público de los últimos 14 días.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Visitas", value: totals.views },
          { label: "Visitantes/día", value: totals.approximateUniqueVisitors, hint: "aproximado" },
          { label: "Confirmados", value: totals.appointmentConfirmed },
          { label: "Conversión", value: `${totals.viewToConfirmationRate}%` },
        ].map((item) => (
          <KpiTile key={item.label} className="min-w-0" label={item.label} value={<KpiValue>{item.value}</KpiValue>} hint={"hint" in item ? item.hint : undefined} />
        ))}
      </div>

      <div>
        <p className="mb-2 font-label-sm text-label-sm text-on-surface-variant">Visitas por día</p>
        {/* La altura de cada barra es un dato (no un color): el único estilo inline que queda. */}
        <div className="grid h-24 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1" role="img" aria-label="Visitas diarias de los últimos 14 días">
          {analytics.days.map((day, index) => (
            <div key={day.dateISO} className="flex h-full min-w-0 flex-col justify-end gap-1">
              <div className="flex flex-1 items-end rounded-sm bg-surface-container-low" title={`${day.dateISO}: ${day.views} visitas`}>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${day.views === 0 ? 3 : Math.max(8, (day.views / maxDailyViews) * 100)}%` }}
                />
              </div>
              <span className="text-center font-label-xs text-label-xs leading-none tabular-nums text-on-surface-variant">
                {index % 3 === 0 || index === analytics.days.length - 1 ? day.dateISO.slice(8) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {funnel.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex min-w-0 items-center justify-between gap-3 font-label-sm text-label-sm">
              <span className="truncate text-on-surface-variant">{item.label}</span>
              <span className="shrink-0 tabular-nums text-on-surface">{item.value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-low">
              <div className={cn("h-full rounded-full", item.color)} style={{ width: `${(item.value / maxFunnel) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export async function AnalyticsSection({ data }: { data: ReportesData }) {
  return <PublicBookingAnalytics analytics={await data.analytics} />;
}

export async function EvolutionSection({ data }: { data: ReportesData }) {
  const [current, evolution] = await Promise.all([data.current, data.evolution]);
  const series = evolutionSeries(data.evolutionMonths, evolution, current);

  return (
    <Card hoverLift={false} className="space-y-md p-lg">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
          <Icon name="show_chart" className="text-[16px]" />
        </span>
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Cómo vienen los últimos meses</h2>
          <p className="truncate font-body-sm text-body-sm text-on-surface-variant">Ingresos facturados, mes a mes.</p>
        </div>
      </div>
      <VerticalBarChart data={series} formatValue={(v) => `$${Math.round(v / 1000)}k`} />
    </Card>
  );
}

export async function TeamAndServicesSection({ data, tenantSlug }: { data: ReportesData; tenantSlug: string }) {
  const [current, activeStaff] = await Promise.all([data.current, data.activeStaff]);
  const top = current.completed.staff[0];

  return (
    <>
      {activeStaff > 1 && top && (
        <Card hoverLift={false} className="flex items-center gap-3 p-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="workspace_premium" className="text-[18px]" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={top.name} src={top.photo} size="md" />
            <div className="min-w-0">
              <p className="font-label-sm text-label-sm text-on-surface-variant">Profesional del mes</p>
              <p className="truncate font-headline-sm text-headline-sm text-on-surface">{top.name}</p>
              <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {top.count} turno{top.count === 1 ? "" : "s"} completado{top.count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </Card>
      )}
      <ServicesCard tenantSlug={tenantSlug} services={current.completed.services.slice(0, 5)} ticketMasAlto={current.completed.ticketMax} />
    </>
  );
}
