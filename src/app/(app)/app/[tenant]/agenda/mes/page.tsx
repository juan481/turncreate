import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  format 
} from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { ViewToggle } from "../view-toggle";
import { RealtimeAgendaRefresh } from "../realtime-refresh";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AgendaMonthPage({
  params,
  searchParams,
}: PageProps<"/app/[tenant]/agenda/mes">) {
  const { tenant: tenantSlug } = await params;
  const { date } = await searchParams;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const now = new TZDate(new Date(), tenant.timezone);
  const dateISO = typeof date === "string" ? date : format(now, "yyyy-MM-dd");
  
  const currentDate = new TZDate(`${dateISO}T00:00:00`, tenant.timezone);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Consider week starting on Monday (1).
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const startUTC = startDate.toISOString();
  // We need to fetch until the very end of the endDate
  const endUTC = new TZDate(`${format(endDate, "yyyy-MM-dd")}T23:59:59.999`, tenant.timezone).toISOString();

  const { data: appointments, error } = await supabase
    .from("appointments")
    .select("starts_at, status")
    .eq("tenant_id", tenant.id)
    .gte("starts_at", startUTC)
    .lte("starts_at", endUTC);

  if (error) throw error;

  // Group confirmed and completed appointments by date
  const countsByDate = new Map<string, number>();
  for (const appointment of appointments) {
    if (appointment.status === "confirmed" || appointment.status === "completed") {
      const apptDate = new TZDate(appointment.starts_at, tenant.timezone);
      const dateStr = format(apptDate, "yyyy-MM-dd");
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
    }
  }

  const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  return (
    <div className="space-y-lg">
      <RealtimeAgendaRefresh tenantId={tenant.id} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Agenda
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant capitalize">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle tenantSlug={tenantSlug} dateISO={dateISO} active="month" />
          <Link
            href={`/app/${tenantSlug}/agenda/nuevo?date=${dateISO}`}
            className={buttonVariants({ size: "default" })}
          >
            + Nuevo turno
          </Link>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface text-on-surface shadow-card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-surface-muted">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center font-label-md text-label-md text-on-surface-variant">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 auto-rows-[120px]">
          {days.map((day, dayIdx) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, now);
            const count = countsByDate.get(dateStr) ?? 0;
            
            return (
              <Link 
                key={day.toString()}
                href={`/app/${tenantSlug}/agenda?date=${dateStr}`}
                className={cn(
                  "border-b border-r border-border p-2 transition-colors hover:bg-secondary-soft focus:outline-none flex flex-col group",
                  !isCurrentMonth && "bg-surface-muted opacity-50",
                  dayIdx % 7 === 6 && "border-r-0"
                )}
              >
                <div className="flex justify-between items-start">
                  <span className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-full font-body-sm text-body-sm transition-colors",
                    isToday ? "bg-primary text-on-primary font-bold" : "text-on-surface group-hover:bg-surface-muted"
                  )}>
                    {format(day, "d")}
                  </span>
                </div>
                
                {count > 0 && (
                  <div className="mt-auto">
                    <span className="inline-flex w-full items-center justify-center rounded-inner bg-secondary-soft p-1 font-label-sm text-label-sm text-on-surface group-hover:bg-surface-muted transition-colors">
                      {count} turno{count !== 1 && 's'}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
