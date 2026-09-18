import { TZDate } from "@date-fns/tz";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { NewStaffForm } from "./new-staff-form";
import { NewTimeBlockForm } from "./new-time-block-form";
import { EditScheduleForm } from "./edit-schedule-form";
import { EditStaffServicesForm } from "./edit-staff-services-form";
import { CommissionForm } from "./commission-form";
import type { ServiceOption } from "./services-checkbox-list";

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

  const [staffRes, timeBlocksRes, servicesRes, staffServicesRes, commissionsRes] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, color, active, photo_url, staff_schedules(weekday, starts_at, ends_at)")
      .eq("tenant_id", tenant.id)
      .order("display_name"),
    supabase
      .from("time_blocks")
      .select("id, staff_id, starts_at, ends_at, kind, reason, staff(display_name)")
      .eq("tenant_id", tenant.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
    supabase
      .from("services")
      .select("id, name, service_categories(name)")
      .eq("tenant_id", tenant.id)
      .eq("active", true)
      .order("sort"),
    supabase.from("staff_services").select("staff_id, service_id, services(name)"),
    supabase
      .from("commission_rules")
      .select("staff_id, type, value")
      .eq("tenant_id", tenant.id)
      .is("service_id", null)
      .is("category_id", null),
  ]);

  if (staffRes.error) throw staffRes.error;
  if (timeBlocksRes.error) throw timeBlocksRes.error;
  if (servicesRes.error) throw servicesRes.error;
  if (staffServicesRes.error) throw staffServicesRes.error;
  if (commissionsRes.error) throw commissionsRes.error;
  const staff = staffRes.data;
  const timeBlocks = timeBlocksRes.data;

  const commissionByStaff = new Map(
    commissionsRes.data.map((c) => [c.staff_id as string, { type: c.type as "percent" | "fixed", value: Number(c.value) }]),
  );

  // "Quién trabaja hoy" (sección 3.3): día de la semana actual en la zona
  // horaria del local, cruzado con bloqueos vigentes ahora mismo.
  const now = new TZDate(new Date(), tenant.timezone);
  const todayWeekday = now.getDay();
  const nowInstant = now.toISOString();
  const blockedStaffIds = new Set(
    timeBlocks
      .filter((b) => b.staff_id && b.starts_at <= nowInstant && b.ends_at >= nowInstant)
      .map((b) => b.staff_id as string),
  );

  const serviceOptions: ServiceOption[] = servicesRes.data.map((s) => ({
    id: s.id,
    name: s.name,
    categoryName: s.service_categories?.name ?? null,
  }));

  const servicesByStaff = new Map<string, { id: string; name: string }[]>();
  for (const row of staffServicesRes.data) {
    if (!row.services) continue;
    const list = servicesByStaff.get(row.staff_id) ?? [];
    list.push({ id: row.service_id, name: row.services.name });
    servicesByStaff.set(row.staff_id, list);
  }

  const scheduleByStaff = new Map<string, Map<number, { starts_at: string; ends_at: string }[]>>();
  for (const s of staff) {
    const byWeekday = new Map<number, { starts_at: string; ends_at: string }[]>();
    for (const sc of s.staff_schedules) {
      const list = byWeekday.get(sc.weekday) ?? [];
      list.push(sc);
      byWeekday.set(sc.weekday, list);
    }
    scheduleByStaff.set(s.id, byWeekday);
  }

  const workingToday = staff
    .filter((s) => s.active)
    .map((s) => ({
      staff: s,
      blocksToday: scheduleByStaff.get(s.id)?.get(todayWeekday) ?? [],
      isBlocked: blockedStaffIds.has(s.id),
    }));

  return (
    <div className="space-y-lg">
      <SectionHeaderNew
        title="Staff"
        subtitle={`${staff.length} profesional${staff.length === 1 ? "" : "es"}`}
        newLabel="Nuevo profesional"
        newIcon="person_add"
      >
        <NewStaffForm tenantSlug={tenantSlug} services={serviceOptions} />
      </SectionHeaderNew>

      <Card hoverLift={false} className="space-y-3 p-lg">
        <h2 className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
          <Icon name="today" className="text-[18px] text-secondary" />
          Quién trabaja hoy
        </h2>
        <div className="flex flex-wrap gap-2">
          {workingToday.map(({ staff: s, blocksToday, isBlocked }) => {
            const worksToday = blocksToday.length > 0 && !isBlocked;
            return (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-pill border px-3 py-2 ${
                  worksToday ? "border-status-confirmed-bg bg-status-confirmed-bg" : "border-border bg-surface-container-low"
                }`}
              >
                <Avatar name={s.display_name} src={s.photo_url} size="sm" />
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{s.display_name}</p>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">
                    {isBlocked
                      ? "No disponible hoy"
                      : blocksToday.length > 0
                        ? blocksToday.map((b) => `${b.starts_at.slice(0, 5)}-${b.ends_at.slice(0, 5)}`).join(", ")
                        : "No trabaja hoy"}
                  </p>
                </div>
              </div>
            );
          })}
          {workingToday.length === 0 && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">No hay profesionales activos.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-md sm:grid-cols-2">
        {staff.map((s) => {
          const scheduleByWeekday =
            scheduleByStaff.get(s.id) ?? new Map<number, { starts_at: string; ends_at: string }[]>();
          return (
            <Card key={s.id} className="space-y-3 p-lg">
              <div className="flex items-center gap-2.5">
                <Avatar name={s.display_name} src={s.photo_url} size="md" />
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    {s.display_name}
                  </h2>
                  <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color ?? "#767582" }} />
                    {s.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABEL.map((label, weekday) => {
                  const blocks = scheduleByWeekday.get(weekday);
                  return (
                    <span
                      key={weekday}
                      className={`rounded-pill px-2.5 py-1 font-label-sm text-label-sm ${
                        blocks
                          ? "bg-status-confirmed-bg text-status-confirmed"
                          : "bg-surface-muted text-on-surface-variant"
                      }`}
                    >
                      {label}
                      {blocks && ` ${blocks.map((b) => `${b.starts_at.slice(0, 5)}-${b.ends_at.slice(0, 5)}`).join(", ")}`}
                    </span>
                  );
                })}
              </div>

              <div className="space-y-1">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Servicios que atiende</p>
                <div className="flex flex-wrap gap-1.5">
                  {(servicesByStaff.get(s.id) ?? []).map((svc) => (
                    <span
                      key={svc.id}
                      className="rounded-pill bg-secondary-soft px-2.5 py-1 font-label-sm text-label-sm text-secondary"
                    >
                      {svc.name}
                    </span>
                  ))}
                  {(servicesByStaff.get(s.id) ?? []).length === 0 && (
                    <span className="font-label-sm text-label-sm text-status-alert">
                      Sin servicios asignados todavía
                    </span>
                  )}
                </div>
              </div>

              <details className="group">
                <summary className="cursor-pointer font-label-sm text-label-sm text-secondary [&::-webkit-details-marker]:hidden">
                  Editar servicios
                </summary>
                <div className="mt-3 border-t border-border pt-3">
                  <EditStaffServicesForm
                    tenantSlug={tenantSlug}
                    staffId={s.id}
                    services={serviceOptions}
                    defaultSelected={(servicesByStaff.get(s.id) ?? []).map((svc) => svc.id)}
                  />
                </div>
              </details>

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

              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between font-label-sm text-label-sm text-secondary [&::-webkit-details-marker]:hidden">
                  <span>Comisión</span>
                  {commissionByStaff.get(s.id) && (
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {commissionByStaff.get(s.id)!.type === "percent"
                        ? `${commissionByStaff.get(s.id)!.value}%`
                        : `$${commissionByStaff.get(s.id)!.value.toLocaleString("es-AR")}`}
                    </span>
                  )}
                </summary>
                <div className="mt-3 border-t border-border pt-3">
                  <CommissionForm tenantSlug={tenantSlug} staffId={s.id} current={commissionByStaff.get(s.id) ?? null} />
                </div>
              </details>
            </Card>
          );
        })}
      </div>

      <div className="space-y-md">
        <h2 className="font-headline-md text-headline-md text-on-surface">Bloqueos de horario</h2>
        <Card hoverLift={false} className="p-lg">
          <NewTimeBlockForm tenantSlug={tenantSlug} staff={staff} />
        </Card>
        <Card hoverLift={false} className="divide-y divide-border p-0">
          {timeBlocks.map((block) => (
            <div key={block.id} className="flex items-center gap-3 px-lg py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                <Icon name="event_busy" className="text-[18px]" />
              </span>
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
            <p className="px-lg py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
              Sin bloqueos próximos.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
