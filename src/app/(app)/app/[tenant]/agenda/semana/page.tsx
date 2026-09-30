import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfWeek } from "date-fns";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { Card } from "@/components/ui/card";
import { ViewToggle } from "../view-toggle";

const WEEKDAY_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toISODate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export default async function AgendaSemanaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/semana">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const referenceDate =
    typeof date === "string" ? new Date(`${date}T12:00:00`) : new TZDate(new Date(), tenant.timezone);
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartUTC = new Date(new TZDate(`${toISODate(weekStart)}T00:00:00`, tenant.timezone).toISOString());
  const weekEndUTC = new Date(
    new TZDate(`${toISODate(addDays(weekStart, 6))}T23:59:59.999`, tenant.timezone).toISOString(),
  );

  const { db } = firebaseAdmin();
  const [staffSnapshot, appointmentsSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    db
      .collection("tenants")
      .doc(tenant.id)
      .collection("appointments")
      .where("startsAt", ">=", weekStartUTC)
      .where("startsAt", "<=", weekEndUTC)
      .get(),
  ]);

  const staffById = new Map(staffSnapshot.docs.map((doc) => [doc.id, { displayName: String(doc.data().displayName), color: doc.data().color as string | undefined }]));

  const countsByDay = new Map<string, Map<string, number>>();
  for (const doc of appointmentsSnapshot.docs) {
    const data = doc.data();
    if (data.status === "cancelled") continue;
    const dayISO = format(new TZDate(data.startsAt.toDate(), tenant.timezone), "yyyy-MM-dd");
    const byStaff = countsByDay.get(dayISO) ?? new Map<string, number>();
    byStaff.set(data.staffId, (byStaff.get(data.staffId) ?? 0) + 1);
    countsByDay.set(dayISO, byStaff);
  }

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Agenda
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Semana del {toISODate(weekStart)}
          </p>
        </div>
        <ViewToggle tenantSlug={tenantSlug} dateISO={toISODate(referenceDate)} active="week" />
      </div>

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, i) => {
          const dayISO = toISODate(day);
          const byStaff = countsByDay.get(dayISO) ?? new Map<string, number>();
          const total = Array.from(byStaff.values()).reduce((sum, n) => sum + n, 0);

          return (
            <Link key={dayISO} href={`/app/${tenantSlug}/agenda?date=${dayISO}`}>
              <Card className="h-full space-y-2 p-lg">
                <div className="flex items-baseline justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface">
                    {WEEKDAY_LABEL[i]} {day.getDate()}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {total} turno{total === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-1">
                  {Array.from(byStaff.entries()).map(([staffId, count]) => {
                    const staff = staffById.get(staffId);
                    return (
                      <div key={staffId} className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: staff?.color ?? "#767582" }}
                        />
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {staff?.displayName} ({count})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
