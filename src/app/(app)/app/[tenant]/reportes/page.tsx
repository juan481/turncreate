import { Suspense } from "react";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { addMonthsISO, isDateISO, monthLabel, todayISO } from "@/lib/dates";
import { CajaTabs } from "../caja/caja-tabs";
import { loadReportes } from "./data";
import { ExportButton, MonthSelect } from "./ReportesClient";
import { AnalyticsSection, ClientKpis, EvolutionSection, MoneyKpis, TeamAndServicesSection } from "./sections";
import { CardSkeleton, KpiGridSkeleton } from "./skeletons";

export default async function ReportesPage({ params, searchParams }: { params: Promise<{ tenant: string }>; searchParams: Promise<{ month?: string }> }) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantPage(slug);
  const sp = await searchParams;

  const currentMonthISO = todayISO(tenant.timezone).slice(0, 7);
  const requested = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) && isDateISO(`${sp.month}-01`) ? sp.month : null;
  const monthISO = requested ?? currentMonthISO;

  // Arranca todas las lecturas YA, en paralelo; cada sección espera la suya
  // adentro de su <Suspense> y se muestra apenas llega (lo liviano primero).
  const data = loadReportes(tenant, monthISO);

  const monthOptions = Array.from({ length: 12 }).map((_, index) => {
    const pointISO = addMonthsISO(`${currentMonthISO}-01`, -index);
    return { value: pointISO.slice(0, 7), label: monthLabel(pointISO) };
  });

  return (
    <div className="space-y-lg">
      <CajaTabs tenantSlug={slug} active="reportes" />
      {/* El AppBar mobile ya muestra "Reportes" + volver -- el <h1> de acá
          solo hace falta en el header-pill de desktop. */}
      <div className="min-w-0 space-y-sm">
        <h1 className="hidden font-headline-lg-mobile text-headline-lg-mobile text-on-surface lg:block">Reportes</h1>
        <MonthSelect tenantSlug={slug} monthISO={monthISO} monthOptions={monthOptions} />
      </div>

      {/* `key` = mes: al cambiar de mes cada sección vuelve a su esqueleto
          en vez de dejar los números del mes anterior a la vista. */}
      <Suspense key={`clients-${monthISO}`} fallback={<KpiGridSkeleton count={4} />}>
        <ClientKpis data={data} />
      </Suspense>
      <Suspense key={`money-${monthISO}`} fallback={<KpiGridSkeleton count={8} />}>
        <MoneyKpis data={data} />
      </Suspense>
      <Suspense key={`analytics-${monthISO}`} fallback={<CardSkeleton className="h-72" />}>
        <AnalyticsSection data={data} />
      </Suspense>
      <Suspense key={`evolution-${monthISO}`} fallback={<CardSkeleton />}>
        <EvolutionSection data={data} />
      </Suspense>
      <Suspense key={`services-${monthISO}`} fallback={<CardSkeleton />}>
        <TeamAndServicesSection data={data} tenantSlug={slug} />
      </Suspense>

      <ExportButton tenantSlug={slug} monthISO={monthISO} />
    </div>
  );
}
