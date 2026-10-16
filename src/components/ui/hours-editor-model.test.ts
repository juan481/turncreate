import { describe, expect, it } from "vitest";
import {
  addSplitBlock,
  copyDayToOpenDays,
  dayError,
  daysToHours,
  defaultWeek,
  flatHoursError,
  hoursToDays,
  removeSplitBlock,
  sameHours,
  setDayActive,
  suggestSecondBlock,
  updateBlock,
  weekError,
  type DayHours,
} from "./hours-editor-model";

const day = (weekday: number, blocks: [string, string][], active = true): DayHours => ({
  weekday,
  active,
  blocks: blocks.map(([opens_at, closes_at]) => ({ opens_at, closes_at })),
});

describe("hoursToDays / daysToHours", () => {
  it("arma la semana de lunes a domingo y marca cerrados los días sin franjas", () => {
    const days = hoursToDays([
      { weekday: 6, opens_at: "09:00:00", closes_at: "13:00:00" },
      { weekday: 1, opens_at: "17:00", closes_at: "21:00" },
      { weekday: 1, opens_at: "09:00", closes_at: "13:00" },
    ]);
    expect(days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(days[0]).toEqual(day(1, [["09:00", "13:00"], ["17:00", "21:00"]]));
    expect(days[1].active).toBe(false);
    expect(days[5]).toEqual(day(6, [["09:00", "13:00"]]));
  });

  it("solo devuelve los días abiertos, con las franjas ordenadas", () => {
    const hours = daysToHours([day(1, [["17:00", "21:00"], ["09:00", "13:00"]]), day(2, [["09:00", "18:00"]], false)]);
    expect(hours).toEqual([
      { weekday: 1, opens_at: "09:00", closes_at: "13:00" },
      { weekday: 1, opens_at: "17:00", closes_at: "21:00" },
    ]);
  });

  it("la semana por defecto abre de lunes a viernes", () => {
    expect(defaultWeek().filter((d) => d.active).map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("validación", () => {
  it("acepta un día cerrado aunque tenga horas raras", () => {
    expect(dayError(day(1, [["20:00", "10:00"]], false))).toBeNull();
  });

  it("pide que el cierre sea después de la apertura", () => {
    expect(dayError(day(1, [["18:00", "09:00"]]))).toMatch(/cierre/);
    expect(dayError(day(1, [["09:00", "09:00"]]))).toMatch(/cierre/);
  });

  it("detecta franjas que se pisan, sin importar el orden en que se cargaron", () => {
    expect(dayError(day(1, [["15:00", "20:00"], ["09:00", "16:00"]]))).toMatch(/pisan/);
    expect(dayError(day(1, [["09:00", "13:00"], ["13:00", "20:00"]]))).toBeNull();
  });

  it("pide los dos horarios completos", () => {
    expect(dayError(day(1, [["", "18:00"]]))).toMatch(/Completá/);
  });

  it("nombra el día con problema y exige al menos un día abierto", () => {
    expect(weekError([day(1, [["09:00", "18:00"]]), day(3, [["19:00", "10:00"]])])).toMatch(/^Miércoles:/);
    expect(weekError([day(1, [["09:00", "18:00"]], false)])).toMatch(/al menos un día/);
    expect(weekError([day(1, [["09:00", "18:00"]], false)], { requireOpenDay: false })).toBeNull();
  });

  it("valida la lista plana que llega al servidor", () => {
    expect(flatHoursError([{ weekday: 1, opens_at: "09:00", closes_at: "18:00" }])).toBeNull();
    expect(flatHoursError([{ weekday: 9, opens_at: "09:00", closes_at: "18:00" }])).toMatch(/día/);
    expect(flatHoursError([{ weekday: 1, opens_at: "9:00", closes_at: "18:00" }])).toMatch(/Completá/);
    expect(
      flatHoursError([
        { weekday: 1, opens_at: "08:00", closes_at: "10:00" },
        { weekday: 1, opens_at: "11:00", closes_at: "13:00" },
        { weekday: 1, opens_at: "14:00", closes_at: "18:00" },
      ]),
    ).toMatch(/hasta 2/);
    expect(flatHoursError([])).toMatch(/al menos un día/);
  });
});

describe("acciones del editor", () => {
  it("al abrir un día sin tocar copia el horario del día abierto anterior", () => {
    const week = updateBlock(defaultWeek(), 5, 0, { closes_at: "20:00" });
    const saturday = setDayActive(week, 6, true).find((d) => d.weekday === 6)!;
    expect(saturday).toEqual(day(6, [["09:00", "20:00"]]));
  });

  it("si el día ya tenía horario propio, lo recupera al volver a abrirlo", () => {
    const week = [day(1, [["09:00", "18:00"]]), day(6, [["09:00", "13:00"]])];
    const reopened = setDayActive(setDayActive(week, 6, false), 6, true);
    expect(reopened[1]).toEqual(day(6, [["09:00", "13:00"]]));
  });

  it("el domingo busca hacia atrás dando la vuelta a la semana", () => {
    const week = [day(1, [["10:00", "14:00"]]), day(0, [["09:00", "18:00"]], false)];
    expect(setDayActive(week, 0, true)[1]).toEqual(day(0, [["10:00", "14:00"]]));
  });

  it("horario partido: sugiere una segunda franja que no pisa la primera y respeta el máximo", () => {
    expect(suggestSecondBlock({ opens_at: "09:00", closes_at: "13:00" })).toEqual({ opens_at: "17:00", closes_at: "21:00" });
    expect(suggestSecondBlock({ opens_at: "09:00", closes_at: "18:00" })).toEqual({ opens_at: "19:00", closes_at: "23:00" });
    const split = addSplitBlock([day(1, [["09:00", "13:00"]])], 1);
    expect(split[0].blocks).toHaveLength(2);
    expect(dayError(split[0])).toBeNull();
    expect(addSplitBlock(split, 1)[0].blocks).toHaveLength(2);
    expect(removeSplitBlock(split, 1)[0]).toEqual(day(1, [["09:00", "13:00"]]));
  });

  it("copiar a todos solo pisa los días abiertos", () => {
    const week = [day(1, [["09:00", "13:00"], ["17:00", "21:00"]]), day(2, [["10:00", "19:00"]]), day(0, [["09:00", "18:00"]], false)];
    const copied = copyDayToOpenDays(week, 1);
    expect(copied[1]).toEqual(day(2, [["09:00", "13:00"], ["17:00", "21:00"]]));
    expect(copied[2]).toEqual(week[2]);
    copied[1].blocks[0].opens_at = "08:00";
    expect(copied[0].blocks[0].opens_at).toBe("09:00");
  });
});

describe("sameHours", () => {
  it("compara sin importar el orden ni los segundos", () => {
    expect(
      sameHours(
        [{ weekday: 1, opens_at: "09:00", closes_at: "18:00" }, { weekday: 2, opens_at: "09:00", closes_at: "18:00" }],
        [{ weekday: 2, opens_at: "09:00:00", closes_at: "18:00" }, { weekday: 1, opens_at: "09:00", closes_at: "18:00" }],
      ),
    ).toBe(true);
    expect(sameHours([{ weekday: 1, opens_at: "09:00", closes_at: "18:00" }], [])).toBe(false);
  });
});
