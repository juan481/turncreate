import Link from "next/link";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getMonthData } from "@/server/agenda-month";
import { isDateISO, todayISO } from "@/lib/dates";
import { ViewToggle } from "../view-toggle";
import { RealtimeAgendaRefresh } from "../realtime-refresh";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { InfiniteMonthScroller } from "./infinite-month-scroller";

export default async function AgendaMonthPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/mes">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const { tenant } = await requireTenantPage(tenantSlug);

  const todayStr = todayISO(tenant.timezone);
  // Sin isDateISO, un ?date= inválido llegaba directo a getMonthData ->
  // parseDateISO, que tira sin capturar (RangeError de Date por abajo).
  const dateISO = typeof date === "string" && isDateISO(date) ? date : todayStr;

  const initialMonth = await getMonthData({
    tenantId: tenant.id,
    timezone: tenant.timezone,
    monthISO: dateISO,
  });

  return (
    <div className="space-y-lg">
      <RealtimeAgendaRefresh tenantId={tenant.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {/* En mobile el AppBar ya muestra "Calendario" como título --
              este h1 decía otra cosa ("Agenda") y quedaba duplicado justo
              arriba, así que ahora es solo para desktop (sección 3 del
              contrato del shell). */}
          <h1 className="hidden font-headline-lg-mobile text-headline-lg-mobile text-on-surface lg:block">
            Agenda
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Desplazate para ver los próximos meses
          </p>
        </div>
        {/* flex-col -> sm:flex-row: ViewToggle (3 tabs) + "Nuevo Turno"
            juntos en una fila no entraban en ~320px de ancho útil y se
            salían del borde. "Nuevo Turno" además solo hace falta en
            desktop -- en mobile ya está el botón central de la barra
            inferior (igual que en la vista Día). */}
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <ViewToggle tenantSlug={tenantSlug} dateISO={dateISO} active="month" />
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={cn(buttonVariants({ size: "default" }), "hidden sm:inline-flex")}
          >
            <Icon name="add" className="text-[18px]" />
            Nuevo Turno
          </Link>
        </div>
      </div>

      <InfiniteMonthScroller
        tenantSlug={tenantSlug}
        initialMonth={initialMonth}
        todayISO={todayStr}
        selectedISO={dateISO}
      />
    </div>
  );
}
