import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { Icon } from "@/components/ui/icon";
import { DayDial, type DayDialItem } from "@/components/ui/day-dial";
import { addDaysISO, dayRange, monthLabel, todayISO, toDateISOInTz } from "@/lib/dates";

/** Días a cada lado de hoy que ofrece el dial (siempre incluye el día elegido). */
const DIAL_RANGE_DAYS = 60;
/**
 * Días a cada lado del día elegido para los que se cuentan turnos (el
 * puntito del dial). No se cuenta todo el dial: serían ~120 días de
 * turnos leídos de Firestore en cada carga de la agenda.
 */
const COUNT_RANGE_DAYS = 10;

/**
 * Navegación de días arriba de la vista Día: un "dial" horizontal con
 * scroll-snap (±60 días alrededor de hoy) en vez de la vieja tira fija
 * de la semana + flechas. El día elegido queda centrado y resaltado, hoy
 * lleva un anillo, y un puntito marca los días que tienen turnos
 * (cancelados/vencidos no cuentan, mismo criterio que la vista Día).
 *
 * Server Component: hace su propia consulta de conteos, así `page.tsx`
 * no carga turnos de otros días solo para pintar esta tira. El dial en sí
 * (scroll, centrado) es la primitiva cliente `DayDial`.
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
  const today = todayISO(timezone);
  const minDialISO = [addDaysISO(today, -DIAL_RANGE_DAYS), addDaysISO(dateISO, -7)].sort()[0];
  const maxDialISO = [addDaysISO(today, DIAL_RANGE_DAYS), addDaysISO(dateISO, 7)].sort()[1];

  const countFromISO = addDaysISO(dateISO, -COUNT_RANGE_DAYS);
  const countToISO = addDaysISO(dateISO, COUNT_RANGE_DAYS);
  const { db } = firebaseAdmin();
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("appointments")
    .where("startsAt", ">=", dayRange(countFromISO, timezone).start)
    .where("startsAt", "<", dayRange(countToISO, timezone).end)
    .get();

  const countByDay = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === "cancelled" || data.status === "expired" || !data.startsAt?.toDate) continue;
    const dISO = toDateISOInTz(data.startsAt.toDate(), timezone);
    countByDay.set(dISO, (countByDay.get(dISO) ?? 0) + 1);
  }

  const items: DayDialItem[] = [];
  for (let iso = minDialISO; iso <= maxDialISO; iso = addDaysISO(iso, 1)) {
    const inCountRange = iso >= countFromISO && iso <= countToISO;
    items.push({
      dateISO: iso,
      href: `/app/${tenantSlug}/agenda?date=${iso}`,
      count: inCountRange ? countByDay.get(iso) ?? 0 : undefined,
    });
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate font-label-lg text-label-lg text-on-surface">{monthLabel(dateISO)}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            href={`/app/${tenantSlug}/agenda?date=${today}`}
            aria-current={dateISO === today ? "date" : undefined}
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

      <DayDial items={items} selectedISO={dateISO} todayISO={today} />
    </div>
  );
}
