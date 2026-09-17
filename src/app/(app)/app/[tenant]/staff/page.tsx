import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { NewStaffForm } from "./new-staff-form";
import { NewTimeBlockForm } from "./new-time-block-form";
import { EditScheduleForm } from "./edit-schedule-form";

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const KIND_LABEL: Record<string, string> = {
  vacation: "Vacaciones",
  sick_leave: "Licencia médica",
  break: "Descanso",
  other: "Otro",
};

// TZDate hereda de Date: getHours/getMinutes/etc ya devuelven la hora en
// `timezone`, pero toLocaleString no está garantizado que respete esa
// zona -- se arma el string a mano con los getters que sí funcionan.
function formatInstant(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(zoned.getDate())}/${pad(zoned.getMonth() + 1)} ${pad(zoned.getHours())}:${pad(zoned.getMinutes())}`;
}

export default async function StaffPage({
  params,
}: PageProps<"/app/[tenant]/staff">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [staffRes, timeBlocksRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, color, active, staff_schedules(weekday, starts_at, ends_at)")
      .eq("tenant_id", tenant.id)
      .order("display_name"),
    supabase
      .from("time_blocks")
      .select("id, starts_at, ends_at, kind, reason, staff(display_name)")
      .eq("tenant_id", tenant.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (timeBlocksRes.error) throw timeBlocksRes.error;
  const staff = staffRes.data;
  const timeBlocks = timeBlocksRes.data;

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Staff
      </h1>

      <Card className="p-lg">
        <NewStaffForm tenantSlug={tenantSlug} />
      </Card>

      <div className="grid gap-md sm:grid-cols-2">
        {staff.map((s) => {
          const scheduleByWeekday = new Map(s.staff_schedules.map((sc) => [sc.weekday, sc]));
          return (
            <Card key={s.id} className="space-y-3 p-lg">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color ?? "#767582" }}
                />
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  {s.display_name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABEL.map((label, weekday) => {
                  const schedule = scheduleByWeekday.get(weekday);
                  return (
                    <span
                      key={weekday}
                      className={`rounded-pill px-2.5 py-1 font-label-sm text-label-sm ${
                        schedule
                          ? "bg-status-confirmed-bg text-status-confirmed"
                          : "bg-surface-muted text-on-surface-variant"
                      }`}
                    >
                      {label}
                      {schedule && ` ${schedule.starts_at.slice(0, 5)}-${schedule.ends_at.slice(0, 5)}`}
                    </span>
                  );
                })}
              </div>

              <details className="group">
                <summary className="cursor-pointer font-label-sm text-label-sm text-secondary [&::-webkit-details-marker]:hidden">
                  Editar horario
                </summary>
                <div className="mt-3 border-t border-border pt-3">
                  <EditScheduleForm
                    tenantSlug={tenantSlug}
                    staffId={s.id}
                    initialSchedule={s.staff_schedules}
                  />
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      <div className="space-y-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Bloqueos de horario
        </h2>
        <Card className="p-lg">
          <NewTimeBlockForm tenantSlug={tenantSlug} staff={staff} />
        </Card>
        <Card className="divide-y divide-border p-0">
          {timeBlocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between px-lg py-3">
              <div>
                <p className="font-label-md text-label-md text-on-surface">
                  {block.staff?.display_name ?? "Todo el local"} · {KIND_LABEL[block.kind] ?? block.kind}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {formatInstant(block.starts_at, tenant.timezone)} –{" "}
                  {formatInstant(block.ends_at, tenant.timezone)}
                  {block.reason && ` · ${block.reason}`}
                </p>
              </div>
            </div>
          ))}
          {timeBlocks.length === 0 && (
            <p className="px-lg py-6 font-body-sm text-body-sm text-on-surface-variant">
              Sin bloqueos próximos.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
