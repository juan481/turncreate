import { describe, expect, it } from "vitest";
import {
  computeAvailableSlots,
  computeFreeWindows,
  pickLeastBusyStaff,
  unionAnyStaffSlots,
} from "./slots";

function toHHMM(minute: number) {
  const h = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const m = (minute % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

describe("computeFreeWindows", () => {
  it("cruza horarios y resta bloqueos, en el orden de la sección 5.1", () => {
    const businessHours = [{ start: 540, end: 1140 }]; // 09:00-19:00
    const staffSchedule = [{ start: 600, end: 1020 }]; // 10:00-17:00
    const busyRanges = [{ start: 720, end: 780 }]; // 12:00-13:00 bloqueado

    expect(computeFreeWindows({ businessHours, staffSchedule, busyRanges })).toEqual([
      { start: 600, end: 720 },
      { start: 780, end: 1020 },
    ]);
  });
});

describe("computeAvailableSlots", () => {
  it("ofrece horarios cada slotIntervalMin dentro de la ventana libre", () => {
    const freeWindows = [{ start: 600, end: 690 }]; // 10:00-11:30
    const slots = computeAvailableSlots({
      freeWindows,
      phases: [{ kind: "active", minutes: 30 }],
      bufferAfterMin: 0,
      slotIntervalMin: 15,
    });

    // El último inicio posible es 11:00 (30 min -> termina 11:30, justo el borde).
    expect(slots.map(toHHMM)).toEqual(["10:00", "10:15", "10:30", "10:45", "11:00"]);
  });

  it("respeta la anticipación mínima (earliestStart)", () => {
    const freeWindows = [{ start: 540, end: 660 }]; // 09:00-11:00
    const slots = computeAvailableSlots({
      freeWindows,
      phases: [{ kind: "active", minutes: 30 }],
      bufferAfterMin: 0,
      slotIntervalMin: 30,
      earliestStart: 600, // no se puede reservar antes de las 10:00
    });

    expect(slots.map(toHHMM)).toEqual(["10:00", "10:30"]);
  });

  it("con fases con espera, ofrece el slot aunque el hueco de espera esté ocupado por otro turno", () => {
    // Ventana 10:00-12:00, con un bloqueo 10:30-11:10 (otro cliente
    // usando el hueco de espera de este profesional).
    const businessHours = [{ start: 600, end: 720 }];
    const staffSchedule = [{ start: 600, end: 720 }];
    const busyRanges = [{ start: 630, end: 670 }];
    const freeWindows = computeFreeWindows({ businessHours, staffSchedule, busyRanges });

    const slots = computeAvailableSlots({
      freeWindows,
      phases: [
        { kind: "active", minutes: 30 },
        { kind: "wait", minutes: 40 },
        { kind: "active", minutes: 20 },
      ],
      bufferAfterMin: 10,
      slotIntervalMin: 15,
    });

    // 10:00 sigue siendo válido: el tramo activo es 10:00-10:30 (libre) y
    // 11:10-11:40 (libre); el bloqueo cae dentro de la espera, que no
    // necesita estar libre.
    expect(slots.map(toHHMM)).toContain("10:00");
  });
});

describe("combo 'Cualquiera' (least busy staff)", () => {
  it("une los slots de todos los profesionales que dictan el servicio", () => {
    const union = unionAnyStaffSlots([
      { staffId: "a", slots: [600, 630] },
      { staffId: "b", slots: [630, 660] },
    ]);
    expect(union).toEqual([600, 630, 660]);
  });

  it("asigna al profesional con menos minutos ocupados ese día", () => {
    const staffId = pickLeastBusyStaff([
      { staffId: "a", busyMinutes: 180 },
      { staffId: "b", busyMinutes: 90 },
      { staffId: "c", busyMinutes: 120 },
    ]);
    expect(staffId).toBe("b");
  });

  it("devuelve null si no hay profesionales candidatos", () => {
    expect(pickLeastBusyStaff([])).toBeNull();
  });
});
