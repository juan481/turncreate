import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  dayRange,
  formatTimeInTz,
  isDateISO,
  longDayLabel,
  monthRange,
  startOfWeekISO,
  toDateISOInTz,
  todayISO,
  weekRange,
  weekdayOf,
  zonedInstant,
} from "./dates";
import { dayBoundsUTC, instantToMinutes, minutesToInstant } from "@/server/availability";

const AR = "America/Argentina/Buenos_Aires";

// El bug original solo aparecía cuando el PROCESO no estaba en hora
// argentina (el VPS corre en UTC). Se corre la batería completa con
// distintas zonas del proceso para que nunca vuelva a pasar.
for (const processTz of ["UTC", "Asia/Tokyo", AR, "America/Los_Angeles"]) {
  describe(`fechas con TZ del proceso = ${processTz}`, () => {
    const original = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = processTz;
    });
    afterAll(() => {
      process.env.TZ = original;
    });

    it("sábado 10:00 en Argentina queda el sábado (13:00 UTC), no el viernes", () => {
      expect(minutesToInstant("2026-10-10", 600, AR).toISOString()).toBe("2026-10-10T13:00:00.000Z");
      expect(zonedInstant("2026-10-10", 600, AR).toISOString()).toBe("2026-10-10T13:00:00.000Z");
    });

    it("límites del día: [00:00, 24:00) hora argentina", () => {
      const { start, end } = dayRange("2026-10-10", AR);
      expect(start.toISOString()).toBe("2026-10-10T03:00:00.000Z");
      expect(end.toISOString()).toBe("2026-10-11T03:00:00.000Z");
      expect(dayBoundsUTC("2026-10-10", AR)).toEqual({ startUTC: "2026-10-10T03:00:00.000Z", endUTC: "2026-10-11T03:00:00.000Z" });
    });

    it("fin de mes y fin de año", () => {
      expect(dayRange("2026-10-31", AR).end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
      expect(dayRange("2026-12-31", AR).end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
    });

    it("rango de mes: noviembre es noviembre", () => {
      const { start, end, startISO } = monthRange("2026-11-15", AR);
      expect(startISO).toBe("2026-11-01");
      expect(start.toISOString()).toBe("2026-11-01T03:00:00.000Z");
      expect(end.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    });

    it("semana arranca el lunes", () => {
      expect(startOfWeekISO("2026-10-10")).toBe("2026-10-05");
      expect(startOfWeekISO("2026-10-11")).toBe("2026-10-05");
      expect(startOfWeekISO("2026-10-12")).toBe("2026-10-12");
      expect(weekRange("2026-10-10", AR).start.toISOString()).toBe("2026-10-05T03:00:00.000Z");
    });

    it("instante -> fecha y hora locales", () => {
      const instant = new Date("2026-10-10T02:30:00.000Z"); // viernes 23:30 en AR
      expect(toDateISOInTz(instant, AR)).toBe("2026-10-09");
      expect(formatTimeInTz(instant, AR)).toBe("23:30");
      expect(instantToMinutes(instant.toISOString(), AR)).toBe(23 * 60 + 30);
      expect(todayISO(AR, instant)).toBe("2026-10-09");
    });
  });
}

describe("helpers de calendario puros", () => {
  it("weekdayOf", () => {
    expect(weekdayOf("2026-10-10")).toBe(6);
    expect(weekdayOf("2026-10-11")).toBe(0);
  });
  it("addDaysISO / addMonthsISO", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
    expect(addMonthsISO("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonthsISO("2026-01-15", -1)).toBe("2025-12-01");
  });
  it("isDateISO", () => {
    expect(isDateISO("2026-10-10")).toBe(true);
    expect(isDateISO("")).toBe(false);
    expect(isDateISO("2026-13-01")).toBe(false);
    expect(isDateISO("10/10/2026")).toBe(false);
    expect(isDateISO(undefined)).toBe(false);
  });
  it("longDayLabel", () => {
    expect(longDayLabel("2026-10-10")).toBe("Sábado 10 de octubre");
  });
});
