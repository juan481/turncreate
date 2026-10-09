import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { addDaysISO, monthLabel, shortWeekdayLabel, todayISO, toDateISOInTz, weekRange } from "@/lib/dates";

/**
 * Tira de días de la semana + navegación, arriba de la vista Día.
 * Reemplaza el viejo "‹ Día de la semana ›" (que solo movía de a un día
 * y no daba ninguna pista de qué otros días tenían turnos -- parte del
 * "no se entiende el calendario" que reportó el dueño). Ahora:
 * - Las flechas mueven la SEMANA completa (el selector de día puntual ya
 *   lo dan las 7 pills de abajo).
 * - Cada pill muestra día+número+contador chico de turnos: de un vistazo
 *   se ve qué días de la semana tienen algo agendado, sin entrar a cada
 *   uno.
 * - "Mes" da vuelta fácil al calendario completo sin pasar por ViewToggle.
 *
 * Es un Server Component async (no "use client"): hace su propia consulta
 * de conteos por día de la semana, igual que `semana/page.tsx` hace para
 * su propia grilla -- así `page.tsx` (vista Día) no necesita cargar toda
 * la semana solo para pintar esta tira.
 */
export async function DateNav({
  tenantId,
  tenantSlug,
  timezone,
  dateISO,
}: {
  tenantId: string;
  tenantSlug: string;
  timezone: string;
  dateISO: string;
}) {
  const { startISO: weekStartISO, start, end } = weekRange(dateISO, timezone);
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));
  const today = todayISO(timezone);
  const prevWeekISO = addDaysISO(dateISO, -7);
  const nextWeekISO = addDaysISO(dateISO, 7);

  const { db } = firebaseAdmin();
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("appointments")
    .where("startsAt", ">=", start)
    .where("startsAt", "<", end)
    .get();

  // Mismo criterio que la vista Día: un turno cancelado/vencido no cuenta
  // como "algo agendado" en el contador de la pill (si no, un turno
  // reprogramado infla el conteo del día viejo Y del nuevo a la vez).
  const countByDay = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === "cancelled" || data.status === "expired" || !data.startsAt?.toDate) continue;
    const dISO = toDateISOInTz(data.startsAt.toDate(), timezone);
    countByDay.set(dISO, (countByDay.get(dISO) ?? 0) + 1);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={`/app/${tenantSlug}/agenda?date=${prevWeekISO}`}
            aria-label="Semana anterior"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="chevron_left" className="text-[18px]" />
          </Link>
          <span className="truncate font-label-md text-label-md capitalize text-on-surface-variant">
            {monthLabel(dateISO)}
          </span>
          <Link
            href={`/app/${tenantSlug}/agenda?date=${nextWeekISO}`}
            aria-label="Semana siguiente"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
          >
            <Icon name="chevron_right" className="text-[18px]" />
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/app/${tenantSlug}/agenda?date=${today}`}
            className="flex h-11 items-center rounded-pill bg-surface-container-low px-3.5 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Hoy
          </Link>
          <Link
            href={`/app/${tenantSlug}/agenda/mes?date=${dateISO}`}
            aria-label="Ver calendario del mes"
            className="flex h-11 items-center gap-1 rounded-pill bg-surface-container-low px-3.5 font-label-sm text-label-sm text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Icon name="calendar_month" className="text-[14px]" />
            Mes
          </Link>
        </div>
      </div>

      <div className="flex gap-1">
        {days.map((dISO) => {
          const isSelected = dISO === dateISO;
          const isToday = dISO === today;
          const count = countByDay.get(dISO) ?? 0;
          return (
            <Link
              key={dISO}
              href={`/app/${tenantSlug}/agenda?date=${dISO}`}
              className={cn(
                "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-inner py-1.5 transition-colors",
                isSelected
                  ? "bg-primary text-on-primary"
                  : isToday
                    ? "border-2 border-primary text-primary"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              <span className="font-label-xs text-label-xs uppercase">
                {shortWeekdayLabel(dISO).slice(0, 1)}
              </span>
              <span className="font-label-lg text-label-lg font-semibold tabular-nums">
                {Number(dISO.slice(8, 10))}
              </span>
              {count > 0 && (
                <span
                  className={cn(
                    "font-label-xs text-label-xs tabular-nums",
                    isSelected ? "text-on-primary/85" : "text-on-surface-variant",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
