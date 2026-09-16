import { describe, expect, it } from "vitest";
import { computeOccupiedSegments, computeTotalDuration, isCandidateAvailable } from "./segments";

describe("computeOccupiedSegments", () => {
  it("reproduce el ejemplo del plan: 30 aplicación, 40 espera, 20 lavado, 10 buffer desde las 10:00", () => {
    const phases = [
      { kind: "active" as const, minutes: 30 },
      { kind: "wait" as const, minutes: 40 },
      { kind: "active" as const, minutes: 20 },
    ];
    // 10:00 = minuto 600.
    const segments = computeOccupiedSegments(600, phases, 10);

    // Aplicación 10:00-10:30, y lavado+buffer 11:10-11:40. La espera
    // 10:30-11:10 no genera segmento: el profesional queda libre.
    expect(segments).toEqual([
      { start: 600, end: 630 },
      { start: 670, end: 700 },
    ]);
  });

  it("un servicio de una sola fase activa con buffer da un único segmento", () => {
    const segments = computeOccupiedSegments(600, [{ kind: "active", minutes: 45 }], 15);
    expect(segments).toEqual([{ start: 600, end: 660 }]);
  });

  it("sin buffer y sin fases activas no ocupa nada", () => {
    expect(computeOccupiedSegments(600, [{ kind: "wait", minutes: 20 }], 0)).toEqual([]);
  });
});

describe("computeTotalDuration", () => {
  it("suma todas las fases más el buffer (incluye las esperas)", () => {
    const phases = [
      { kind: "active" as const, minutes: 30 },
      { kind: "wait" as const, minutes: 40 },
      { kind: "active" as const, minutes: 20 },
    ];
    expect(computeTotalDuration(phases, 10)).toBe(100);
  });
});

describe("isCandidateAvailable", () => {
  it("acepta cuando cada segmento cae completo en una ventana libre", () => {
    const freeWindows = [
      { start: 540, end: 660 },
      { start: 700, end: 900 },
    ];
    expect(
      isCandidateAvailable(
        [
          { start: 600, end: 630 },
          { start: 700, end: 730 },
        ],
        freeWindows,
      ),
    ).toBe(true);
  });

  it("rechaza cuando un segmento cruza un hueco ocupado (aunque la espera sí lo cruce)", () => {
    // Espera 10:30-11:10 cruza un bloqueo a las 10:45 -- no importa,
    // solo importan los segmentos activos.
    const freeWindows = [
      { start: 540, end: 645 }, // libre hasta 10:45
      { start: 700, end: 900 }, // libre desde 11:40
    ];
    const segments = [
      { start: 600, end: 630 }, // 10:00-10:30, cae en la primera ventana: ok
      { start: 670, end: 700 }, // 11:10-11:40, no cae completo en ninguna ventana
    ];
    expect(isCandidateAvailable(segments, freeWindows)).toBe(false);
  });
});
