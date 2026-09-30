import "server-only";
import { TZDate } from "@date-fns/tz";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";
import { es } from "date-fns/locale";
import { firebaseAdmin } from "@/server/firebase/admin";

export type MonthDay = { dateISO: string; inCurrentMonth: boolean; count: number };
export type MonthData = { monthISO: string; label: string; days: MonthDay[]; totalCount: number };

/** monthISO: cualquier fecha del mes a mostrar (se usa el primer día). */
export async function getMonthData(params: { tenantId: string; timezone: string; monthISO: string }): Promise<MonthData> {
  const currentDate = new TZDate(`${params.monthISO}T00:00:00`, params.timezone);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const daysArr = eachDayOfInterval({ start: startDate, end: endDate });

  const startUTC = new Date(startDate.toISOString());
  const endUTC = new Date(new TZDate(`${format(endDate, "yyyy-MM-dd")}T23:59:59.999`, params.timezone).toISOString());

  const snapshot = await firebaseAdmin()
    .db.collection("tenants")
    .doc(params.tenantId)
    .collection("appointments")
    .where("startsAt", ">=", startUTC)
    .where("startsAt", "<=", endUTC)
    .get();

  const countsByDate = new Map<string, number>();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === "confirmed" || data.status === "completed") {
      const apptDate = new TZDate(data.startsAt.toDate(), params.timezone);
      const dateStr = format(apptDate, "yyyy-MM-dd");
      countsByDate.set(dateStr, (countsByDate.get(dateStr) ?? 0) + 1);
    }
  }

  let totalCount = 0;
  const days: MonthDay[] = daysArr.map((day) => {
    const dateISO = format(day, "yyyy-MM-dd");
    const inCurrentMonth = day.getMonth() === currentDate.getMonth();
    const count = countsByDate.get(dateISO) ?? 0;
    if (inCurrentMonth) totalCount += count;
    return { dateISO, inCurrentMonth, count };
  });

  return {
    monthISO: format(monthStart, "yyyy-MM-dd"),
    label: format(currentDate, "MMMM yyyy", { locale: es }),
    days,
    totalCount,
  };
}
