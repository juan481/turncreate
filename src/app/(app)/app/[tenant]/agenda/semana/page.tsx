import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { addDays, startOfWeek } from "date-fns";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { ViewToggle } from "../view-toggle";

const WEEKDAY_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgendaSemanaPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/semana">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const referenceDate =
    typeof date === "string" ? new Date(`${date}T12:00:00`) : new TZDate(new Date(), tenant.timezone);
  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartUTC = new TZDate(`${toISODate(weekStart)}T00:00:00`, tenant.timezone).toISOString();
  const weekEndUTC = new TZDate(
    `${toISODate(addDays(weekStart, 6))}T23:59:59.999`,
    tenant.timezone,
  ).toISOString();

  const [staffRes, appointmentsRes] = await Promise.all([
    supabase.from("staff").select("id, display_name, color").eq("tenant_id", tenant.id).eq("active", true),
    supabase
      .from("appointments")
      .select("id, staff_id, starts_at, status")
      .eq("tenant_id", tenant.id)
      .gte("starts_at", weekStartUTC)
      .lte("starts_at", weekEndUTC)
      .neq("status", "cancelled"),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (appointmentsRes.error) throw appointmentsRes.error;

  const staffById = new Map(staffRes.data.map((s) => [s.id, s]));

  const countsByDay = new Map<string, Map<string, number>>();
  for (const appointment of appointmentsRes.data) {
    const dayISO = new TZDate(new Date(appointment.starts_at), tenant.timezone).toISOString().slice(0, 10);
    const byStaff = countsByDay.get(dayISO) ?? new Map<string, number>();
    byStaff.set(appointment.staff_id, (byStaff.get(appointment.staff_id) ?? 0) + 1);
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
              <Card className="h-full space-y-2 p-lg transition-shadow hover:shadow-card-hover">
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
                          {staff?.display_name} ({count})
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
