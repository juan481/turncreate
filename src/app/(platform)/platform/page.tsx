import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { KpiTile } from "@/components/ui/kpi-tile";
import { VerticalBarChart } from "@/components/ui/bar-chart";
import { isPlatformAdmin } from "@/server/platform";
import { summarizeTenantRows } from "@/server/platform/model";
import { getPlatformOverview } from "@/server/platform/stats";
import { TenantsClient } from "./tenants-client";

export default async function PlatformDashboardPage() {
  // El notFound() del layout no frena el render de la página (ver
  // src/server/firebase/tenant-page.ts): sin esto, la lista de locales viaja en el RSC.
  if (!(await isPlatformAdmin())) notFound();

  const { rows, analytics } = await getPlatformOverview();
  const totals = summarizeTenantRows(rows);
  const funnel = analytics.totals;
  const chartDays = analytics.days.map((day) => ({ label: day.dateISO.slice(8), value: day.views }));

  return (
    <div className="space-y-lg">
      <div className="min-w-0">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
          Locales de la plataforma
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Uso de cada local, quién está prendido y quién no. Tocá un local para ver el detalle o apagarlo.
        </p>
      </div>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          emphasis
          icon={<Icon name="storefront" />}
          label="Locales"
          value={totals.total}
          hint={`${totals.trial} en prueba`}
        />
        <KpiTile
          icon={<Icon name="check_circle" />}
          label="Activos"
          value={totals.active}
          hint={`${totals.bookingOn} con turnero prendido`}
          hintTone="positive"
        />
        <KpiTile
          icon={<Icon name="block" />}
          label="Apagados"
          value={totals.suspended}
          hintTone={totals.suspended > 0 ? "warning" : "neutral"}
          hint={totals.suspended > 0 ? "No reciben reservas" : "Ninguno"}
        />
        <KpiTile
          icon={<Icon name="event_available" />}
          label="Turnos cargados · 30 días"
          value={totals.appointments30d.toLocaleString("es-AR")}
          hint="Suma de todos los locales"
        />
        <KpiTile
          icon={<Icon name="visibility" />}
          label="Visitas · 14 días"
          value={funnel.views.toLocaleString("es-AR")}
          hint={`${funnel.approximateUniqueVisitors.toLocaleString("es-AR")} visitantes-día aprox.`}
        />
        <KpiTile
          icon={<Icon name="trending_up" />}
          label="Conversión · 14 días"
          value={`${funnel.viewToConfirmationRate.toLocaleString("es-AR")}%`}
          hint={`${funnel.appointmentConfirmed} turnos confirmados online`}
        />
      </section>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Visitas a los turneros</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Suma de todos los locales, día por día.</p>
          </div>
          {/* 14 columnas no entran a 320px: en mobile, la última semana. */}
          <div className="sm:hidden">
            <VerticalBarChart height={140} data={chartDays.slice(-7)} />
          </div>
          <div className="hidden sm:block">
            <VerticalBarChart height={150} data={chartDays} />
          </div>
        </Card>

        <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Embudo público · 14 días</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">De la visita al turno confirmado.</p>
          </div>
          <dl className="space-y-2 font-body-sm text-body-sm">
            {[
              ["Visitas", funnel.views],
              ["Reservas iniciadas", funnel.bookingStarted],
              ["Checkouts", funnel.checkoutStarted],
              ["Pagos aprobados", funnel.paymentApproved],
              ["Turnos confirmados", funnel.appointmentConfirmed],
            ].map(([label, value]) => (
              <div key={label} className="flex min-w-0 justify-between gap-3">
                <dt className="truncate text-on-surface-variant">{label}</dt>
                <dd className="font-label-lg text-label-lg tabular-nums text-on-surface">{Number(value).toLocaleString("es-AR")}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <TenantsClient tenants={rows} />
    </div>
  );
}
