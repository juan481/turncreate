import "server-only";
import { firebaseAdmin } from "@/server/firebase/admin";
import {
  addDaysISO,
  daysInMonth,
  monthLabel,
  startOfDayInTz,
  startOfMonthISO,
  startOfWeekISO,
  toDateISOInTz,
} from "@/lib/dates";

export type MonthDay = { dateISO: string; inCurrentMonth: boolean; count: number };
export type MonthData = { monthISO: string; label: string; days: MonthDay[]; totalCount: number };

/** Estados que cuentan como "turno en agenda" (los mismos en todas las vistas). */
export const ACTIVE_STATUSES = new Set(["confirmed", "completed", "pending_payment"]);

/** monthISO: cualquier fecha del mes a mostrar (se usa el primer día). */
export async function getMonthData(params: { tenantId: string; timezone: string; monthISO: string }): Promise<MonthData> {
  const firstOfMonth = startOfMonthISO(params.monthISO);
  const lastOfMonth = addDaysISO(firstOfMonth, daysInMonth(firstOfMonth) - 1);
  const gridStart = startOfWeekISO(firstOfMonth);
  const gridEnd = addDaysISO(startOfWeekISO(lastOfMonth), 7); // exclusivo

  const snapshot = await firebaseAdmin()
    .db.collection("tenants")
    .doc(params.tenantId)
    .collection("appointments")
    .where("startsAt", ">=", startOfDayInTz(gridStart, params.timezone))
    .where("startsAt", "<", startOfDayInTz(gridEnd, params.timezone))
    .get();

  const countsByDate = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!ACTIVE_STATUSES.has(data.status) || !data.startsAt?.toDate) continue;
    const dateStr = toDateISOInTz(data.startsAt.toDate(), params.timezone);
    countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
  }

  let totalCount = 0;
  const days: MonthDay[] = [];
  for (let dateISO = gridStart; dateISO < gridEnd; dateISO = addDaysISO(dateISO, 1)) {
    const inCurrentMonth = dateISO.slice(0, 7) === firstOfMonth.slice(0, 7);
    const count = countsByDate.get(dateISO) ?? 0;
    if (inCurrentMonth) totalCount += count;
    days.push({ dateISO, inCurrentMonth, count });
  }

  return { monthISO: firstOfMonth, label: monthLabel(firstOfMonth), days, totalCount };
}
