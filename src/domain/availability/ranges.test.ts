import { describe, expect, it } from "vitest";
import { intersectRanges, mergeRanges, subtractRanges } from "./ranges";

describe("mergeRanges", () => {
  it("fusiona rangos solapados y contiguos, y ordena por inicio", () => {
    expect(
      mergeRanges([
        { start: 600, end: 660 },
        { start: 540, end: 600 },
        { start: 700, end: 720 },
      ]),
    ).toEqual([
      { start: 540, end: 660 },
      { start: 700, end: 720 },
    ]);
  });
});

describe("intersectRanges", () => {
  it("cruza business_hours con staff_schedules", () => {
    const businessHours = [{ start: 540, end: 1140 }]; // 09:00-19:00
    const staffSchedule = [{ start: 600, end: 1020 }]; // 10:00-17:00
    expect(intersectRanges(businessHours, staffSchedule)).toEqual([{ start: 600, end: 1020 }]);
  });

  it("devuelve vacío si no hay superposición", () => {
    expect(intersectRanges([{ start: 0, end: 100 }], [{ start: 200, end: 300 }])).toEqual([]);
  });
});

describe("subtractRanges", () => {
  it("resta un bloqueo del medio de una ventana libre", () => {
    const free = [{ start: 540, end: 1140 }];
    const busy = [{ start: 720, end: 780 }]; // 12:00-13:00 almuerzo
    expect(subtractRanges(free, busy)).toEqual([
      { start: 540, end: 720 },
      { start: 780, end: 1140 },
    ]);
  });

  it("elimina la ventana completa si el bloqueo la cubre entera", () => {
    expect(subtractRanges([{ start: 540, end: 600 }], [{ start: 500, end: 700 }])).toEqual([]);
  });
});
