import { describe, expect, it } from "vitest";
import { addDaysISO } from "@/lib/dates";
import { AGENDA_MAX_DAYS_FROM_TODAY, clampAgendaDateISO, DIAL_RANGE_DAYS, dialBounds } from "./dial-range";

const TODAY = "2026-10-16";

function dayCount(minISO: string, maxISO: string) {
  return Math.round((Date.parse(`${maxISO}T00:00:00Z`) - Date.parse(`${minISO}T00:00:00Z`)) / 86_400_000) + 1;
}

describe("dialBounds", () => {
  it("hoy elegido: ±60 días alrededor de hoy", () => {
    expect(dialBounds(TODAY, TODAY)).toEqual({ minISO: addDaysISO(TODAY, -60), maxISO: addDaysISO(TODAY, 60) });
  });

  it("un día cercano a hoy sigue incluyendo hoy", () => {
    const { minISO, maxISO } = dialBounds("2026-11-20", TODAY);
    expect(minISO <= TODAY && maxISO >= "2026-11-20").toBe(true);
  });

  it("un día lejano no arma un dial gigante (nunca más de ±60 del elegido)", () => {
    for (const dateISO of ["2020-01-01", "2036-10-14", "2031-05-05"]) {
      const { minISO, maxISO } = dialBounds(dateISO, TODAY);
      expect(minISO <= dateISO && dateISO <= maxISO).toBe(true);
      expect(dayCount(minISO, maxISO)).toBeLessThanOrEqual(2 * DIAL_RANGE_DAYS + 1);
    }
  });
});

describe("clampAgendaDateISO", () => {
  it("deja pasar fechas razonables", () => {
    expect(clampAgendaDateISO("2027-03-01", TODAY)).toBe("2027-03-01");
    expect(clampAgendaDateISO("2024-01-01", TODAY)).toBe("2024-01-01");
  });

  it("acota años absurdos a ±10 años de hoy", () => {
    expect(clampAgendaDateISO("9999-12-31", TODAY)).toBe(addDaysISO(TODAY, AGENDA_MAX_DAYS_FROM_TODAY));
    expect(clampAgendaDateISO("0001-01-01", TODAY)).toBe(addDaysISO(TODAY, -AGENDA_MAX_DAYS_FROM_TODAY));
    // Y el dial de esas fechas se puede armar sin años de 5 dígitos.
    const { maxISO } = dialBounds(clampAgendaDateISO("9999-12-31", TODAY), TODAY);
    expect(maxISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
