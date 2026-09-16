import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { NewStaffForm } from "./new-staff-form";

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function StaffPage({
  params,
}: PageProps<"/app/[tenant]/staff">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, display_name, color, active, staff_schedules(weekday, starts_at, ends_at)")
    .eq("tenant_id", tenant.id)
    .order("display_name");

  if (error) throw error;

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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
