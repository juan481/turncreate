import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getMonthData } from "@/server/agenda-month";
import { ViewToggle } from "../view-toggle";
import { RealtimeAgendaRefresh } from "../realtime-refresh";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InfiniteMonthScroller } from "./infinite-month-scroller";

export default async function AgendaMonthPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/mes">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const now = new TZDate(new Date(), tenant.timezone);
  const todayISO = format(now, "yyyy-MM-dd");
  const dateISO = typeof date === "string" ? date : todayISO;

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
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Agenda
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Desplazate para ver los próximos meses
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle tenantSlug={tenantSlug} dateISO={dateISO} active="month" />
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={buttonVariants({ size: "default" })}
          >
            <Icon name="add" className="text-[18px]" />
            Nuevo Turno
          </Link>
        </div>
      </div>

      <InfiniteMonthScroller tenantSlug={tenantSlug} initialMonth={initialMonth} todayISO={todayISO} />
    </div>
  );
}
