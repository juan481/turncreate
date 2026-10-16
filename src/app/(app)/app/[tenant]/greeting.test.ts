import { describe, expect, it } from "vitest";
import { currentDayPart, dayPartForHour, firstNameOf, greetingLines } from "./greeting";

describe("dayPartForHour", () => {
  it("corta en 5, 12 y 20", () => {
    expect(dayPartForHour(4)).toBe("night");
    expect(dayPartForHour(5)).toBe("morning");
    expect(dayPartForHour(11)).toBe("morning");
    expect(dayPartForHour(12)).toBe("afternoon");
    expect(dayPartForHour(19)).toBe("afternoon");
    expect(dayPartForHour(20)).toBe("night");
    expect(dayPartForHour(0)).toBe("night");
  });
});

describe("currentDayPart", () => {
  it("usa la zona del local, no la del proceso", () => {
    // 10:30 UTC = 07:30 en Buenos Aires (UTC-3) -> mañana; en Tokio son 19:30.
    const instant = new Date(Date.UTC(2026, 9, 16, 10, 30));
    expect(currentDayPart("America/Argentina/Buenos_Aires", instant)).toBe("morning");
    expect(currentDayPart("Asia/Tokyo", instant)).toBe("afternoon");
    // 01:00 UTC = 22:00 del día anterior en Buenos Aires.
    expect(currentDayPart("America/Argentina/Buenos_Aires", new Date(Date.UTC(2026, 9, 16, 1, 0)))).toBe("night");
  });
});

describe("firstNameOf / greetingLines", () => {
  it("toma el primer nombre y descarta emails", () => {
    expect(firstNameOf("  Ana María López ")).toBe("Ana");
    expect(firstNameOf("ana@mail.com")).toBe("");
    expect(firstNameOf(undefined)).toBe("");
  });

  it("arma saludo y línea según género", () => {
    expect(greetingLines({ dayPart: "morning", firstName: "Ana", gender: "female", tenantName: "Estudio" })).toMatchObject({
      icon: "light_mode",
      title: "Buen día, Ana",
      subtitle: expect.stringContaining("bienvenida"),
    });
    expect(greetingLines({ dayPart: "night", firstName: "", gender: undefined, tenantName: "Estudio" })).toMatchObject({
      icon: "dark_mode",
      title: "Buenas noches",
      subtitle: "Qué bueno verte por Estudio.",
    });
  });
});
