import { describe, expect, it } from "vitest";
import { depositSummary, hoursSummary } from "./summaries";

const block = (weekday: number, opensAt = "09:00", closesAt = "19:00") => ({ weekday, opensAt, closesAt });

describe("hoursSummary", () => {
  it("resume días seguidos con la misma franja", () => {
    expect(hoursSummary([1, 2, 3, 4, 5, 6].map((day) => block(day)))).toBe("Lun a Sáb 9 a 19");
  });

  it("lista días sueltos y muestra minutos cuando no son en punto", () => {
    expect(hoursSummary([block(1, "09:30"), block(3, "09:30"), block(5, "09:30")])).toBe("Lun, Mié y Vie 9:30 a 19");
  });

  it("cuenta días cuando cada uno tiene su horario o es partido", () => {
    expect(hoursSummary([block(1), block(2, "10:00")])).toBe("2 días abiertos");
    expect(hoursSummary([block(1, "09:00", "13:00"), block(1, "16:00", "20:00")])).toBe("1 día abierto, horario partido");
    expect(hoursSummary([])).toBe("Sin horarios cargados");
  });

  it("domingo va al final de la semana", () => {
    expect(hoursSummary([0, 1, 2, 3, 4, 5, 6].map((day) => block(day)))).toBe("Todos los días 9 a 19");
    expect(hoursSummary([block(6), block(0)])).toBe("Sáb y Dom 9 a 19");
  });
});

describe("depositSummary", () => {
  it("describe cada tipo de seña", () => {
    expect(depositSummary({ depositType: "none", depositValue: 0, depositMin: 0 })).toBeNull();
    expect(depositSummary({ depositType: "percent", depositValue: 30, depositMin: 2000 })).toBe("Seña 30% (mín. $2.000)");
    expect(depositSummary({ depositType: "fixed", depositValue: 5000, depositMin: 0 })).toBe("Seña $5.000");
  });
});
