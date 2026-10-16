import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ViewToggle } from "../view-toggle";
import { addDaysISO, dayMonthLabel, isDateISO, toDateISOInTz, todayISO, weekRange } from "@/lib/dates";

const WEEKDAY_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function AgendaSemanaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/semana">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const { tenant } = await requireTenantPage(tenantSlug);

  const todayStr = todayISO(tenant.timezone);
  const referenceISO = typeof date === "string" && isDateISO(date) ? date : todayStr;
  const { startISO: weekStartISO, start, end } = weekRange(referenceISO, tenant.timezone);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
  const prevWeekISO = addDaysISO(referenceISO, -7);
  const nextWeekISO = addDaysISO(referenceISO, 7);

  const { db } = firebaseAdmin();
  const [staffSnapshot, appointmentsSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    db
      .collection("tenants")
      .doc(tenant.id)
      .collection("appointments")
      .where("startsAt", ">=", start)
      .where("startsAt", "<", end)
      .get(),
  ]);

  const staffById = new Map(staffSnapshot.docs.map((doc) => [doc.id, { displayName: String(doc.data().displayName), color: doc.data().color as string | undefined }]));

  const countsByDay = new Map<string, Map<string, number>>();
  for (const doc of appointmentsSnapshot.docs) {
    const data = doc.data();
    if (data.status === "cancelled" || data.status === "expired" || !data.startsAt?.toDate) continue;
    const dayISO = toDateISOInTz(data.startsAt.toDate(), tenant.timezone);
    const byStaff = countsByDay.get(dayISO) ?? new Map<string, number>();
    byStaff.set(data.staffId, (byStaff.get(data.staffId) ?? 0) + 1);
    countsByDay.set(dayISO, byStaff);
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* En mobile el AppBar ya muestra "Semana" como título -- este h1
            duplicaba lo mismo con otra palabra ("Agenda"), así que solo
            queda para desktop (contrato del shell, sección 3). */}
        <h1 className="hidden font-headline-lg-mobile text-headline-lg-mobile text-on-surface lg:block">
          Agenda
        </h1>
        <ViewToggle tenantSlug={tenantSlug} dateISO={referenceISO} active="week" />
      </div>

      <div className="flex items-center justify-between gap-2 rounded-pill bg-surface-container-low p-1">
        <Link
          href={`/app/${tenantSlug}/agenda/semana?date=${prevWeekISO}`}
          aria-label="Semana anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="chevron_left" className="text-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <span className="truncate font-label-lg text-label-lg text-on-surface">
            Semana del {dayMonthLabel(weekStartISO)} al {dayMonthLabel(days[6])}
          </span>
          {referenceISO !== todayStr && (
            <Link
              href={`/app/${tenantSlug}/agenda/semana?date=${todayStr}`}
              className="font-label-sm text-label-sm text-secondary"
            >
              Volver a hoy
            </Link>
          )}
        </div>
        <Link
          href={`/app/${tenantSlug}/agenda/semana?date=${nextWeekISO}`}
          aria-label="Semana siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        >
          <Icon name="chevron_right" className="text-[18px]" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-7">
        {days.map((dayISO, i) => {
          const isToday = dayISO === todayStr;
          const byStaff = countsByDay.get(dayISO) ?? new Map<string, number>();
          const total = Array.from(byStaff.values()).reduce((sum, n) => sum + n, 0);

          return (
            <Link key={dayISO} href={`/app/${tenantSlug}/agenda?date=${dayISO}`}>
              <Card
                className={cn("h-full space-y-2 p-lg", isToday && "border-primary ring-1 ring-primary/30")}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("font-label-lg text-label-lg", isToday ? "text-primary" : "text-on-surface")}>
                    {WEEKDAY_LABEL[i]} {Number(dayISO.slice(8, 10))}
                  </span>
                  <span className="shrink-0 font-label-sm text-label-sm tabular-nums text-on-surface-variant">
                    {total} turno{total === 1 ? "" : "s"}
                  </span>
                </div>
                {byStaff.size === 0 ? (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Sin turnos</p>
                ) : (
                  <div className="space-y-1">
                    {Array.from(byStaff.entries()).map(([staffId, count]) => {
                      const staff = staffById.get(staffId);
                      return (
                        <div key={staffId} className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: staff?.color ?? "#767582" }}
                          />
                          <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
                            {staff?.displayName} ({count})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
