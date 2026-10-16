import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { VerticalBarChart } from "@/components/ui/bar-chart";
import { notFound } from "next/navigation";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getPlatformAnalytics } from "@/server/analytics";
import { isPlatformAdmin } from "@/server/platform";
import { TenantsClient } from "./tenants-client";

export default async function PlatformDashboardPage() {
  // El notFound() del layout no frena el render de la página (ver
  // src/server/firebase/tenant-page.ts): sin esto, la lista de locales viaja en el RSC.
  if (!(await isPlatformAdmin())) notFound();
  const snapshot = await firebaseAdmin().db.collection("tenants").orderBy("createdAt", "desc").get();
  const tenantsList = snapshot.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name ?? ""),
    slug: String(doc.data().slug ?? ""),
    status: String(doc.data().status ?? "trial"),
    timezone: String(doc.data().timezone ?? "America/Argentina/Buenos_Aires"),
    created_at: doc.data().createdAt?.toDate?.().toISOString?.() ?? "",
  }));
  const activeTenants = tenantsList.filter((tenant) => tenant.status === "active").length;
  const platformAnalytics = await getPlatformAnalytics({ tenants: tenantsList, days: 14 });
  const analyticsByTenant = new Map(platformAnalytics.tenants.map((entry) => [entry.tenantId, entry.analytics.totals]));
  const tenantsWithAnalytics = tenantsList.map((tenant) => ({
    ...tenant,
    analytics: analyticsByTenant.get(tenant.id) ?? {
      views: 0,
      appointmentConfirmed: 0,
      viewToConfirmationRate: 0,
    },
  }));
  const totals = platformAnalytics.aggregate.totals;

  const metrics = [
    { label: "Locales activos", value: activeTenants.toString(), icon: "storefront" },
    { label: "Visitas · 14 días", value: totals.views.toString(), icon: "visibility" },
    { label: "Reservas iniciadas", value: totals.bookingStarted.toString(), icon: "edit_calendar" },
    { label: "Turnos confirmados", value: totals.appointmentConfirmed.toString(), icon: "event_available" },
  ];

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
        Dashboard de Plataforma
      </h1>

      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} hoverLift={false} className="flex flex-col gap-md p-lg">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                <Icon name={metric.icon} className="text-[16px]" />
              </span>
              <p className="font-label-sm text-label-sm text-on-surface-variant">{metric.label}</p>
            </div>
            <p className="font-headline-lg text-headline-lg tabular-nums text-on-surface">{metric.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-lg lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Card hoverLift={false} className="space-y-md p-lg">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Visitas de la plataforma</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Suma real de todos los turneros durante los últimos 14 días.</p>
          </div>
          <VerticalBarChart
            height={150}
            data={platformAnalytics.aggregate.days.map((day) => ({ label: day.dateISO.slice(8), value: day.views }))}
          />
        </Card>

        <Card hoverLift={false} className="space-y-md p-lg">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Conversión pública</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">De visita a turno confirmado.</p>
          </div>
          <p className="font-headline-xl-mobile text-headline-xl-mobile tabular-nums text-on-surface">
            {totals.viewToConfirmationRate}%
          </p>
          <div className="space-y-2 font-body-sm text-body-sm">
            <div className="flex justify-between gap-3">
              <span className="text-on-surface-variant">Visitantes/día aprox.</span>
              <strong className="tabular-nums">{totals.approximateUniqueVisitors}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-on-surface-variant">Checkouts</span>
              <strong className="tabular-nums">{totals.checkoutStarted}</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-on-surface-variant">Pagos aprobados</span>
              <strong className="tabular-nums">{totals.paymentApproved}</strong>
            </div>
          </div>
        </Card>
      </div>

      <TenantsClient tenants={tenantsWithAnalytics} />
    </div>
  );
}
