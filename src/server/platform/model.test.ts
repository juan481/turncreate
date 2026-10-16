import { describe, expect, it } from "vitest";
import {
  activityTone,
  auditDocId,
  compactMoney,
  daysAgo,
  depositLabel,
  filterTenants,
  formatMoney,
  isBookingEnabled,
  isValidTenantId,
  normalizeSearch,
  normalizeTenantStatus,
  planBookingChange,
  planLabel,
  planStatusChange,
  platformDateLabel,
  relativeActivityLabel,
  rollingWindowStart,
  summarizeTenantRows,
  toDateOrNull,
  validateReason,
} from "./model";

const TZ = "America/Argentina/Buenos_Aires";
// 16/10/2026 12:00 en Buenos Aires (UTC-3).
const NOW = new Date("2026-10-16T15:00:00Z");

describe("ids y estados", () => {
  it("valida ids de tenant", () => {
    expect(isValidTenantId("e2e_nails_tenant")).toBe(true);
    expect(isValidTenantId("AbC123xyz-_")).toBe(true);
    expect(isValidTenantId("")).toBe(false);
    expect(isValidTenantId("../users")).toBe(false);
    expect(isValidTenantId("a/b")).toBe(false);
    expect(isValidTenantId("x".repeat(65))).toBe(false);
    expect(isValidTenantId(123)).toBe(false);
  });

  it("normaliza el estado (sin dato = trial)", () => {
    expect(normalizeTenantStatus("active")).toBe("active");
    expect(normalizeTenantStatus("suspended")).toBe("suspended");
    expect(normalizeTenantStatus(undefined)).toBe("trial");
    expect(normalizeTenantStatus("onboarding")).toBe("trial");
  });

  it("nombra el plan y trata los locales sin plan como Equipo", () => {
    expect(planLabel("solo")).toBe("Solo");
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel(undefined)).toBe("Equipo (sin plan)");
  });

  it("describe la seña", () => {
    expect(depositLabel({ depositType: "none", depositValue: 0 })).toBe("Sin seña");
    expect(depositLabel({ depositType: "fixed", depositValue: 10000 })).toBe("$10.000 fija");
    expect(depositLabel({ depositType: "percent", depositValue: 30 })).toBe("30%");
    expect(depositLabel({ depositType: "fixed", depositValue: 0 })).toBe("Sin seña");
    expect(depositLabel(undefined)).toBe("Sin seña");
  });

  it("turnero sin dato = prendido, igual que el turnero público", () => {
    expect(isBookingEnabled({})).toBe(true);
    expect(isBookingEnabled(undefined)).toBe(true);
    expect(isBookingEnabled({ publicBookingEnabled: false })).toBe(false);
  });
});

describe("búsqueda y totales", () => {
  const rows = [
    { name: "Peluquería Zeka", slug: "zeka", ownerEmail: "ana@mail.com", status: "active" as const, bookingEnabled: true, appointments30d: 10 },
    { name: "Nails Studio", slug: "nails-studio", ownerEmail: null, status: "trial" as const, bookingEnabled: true, appointments30d: 3 },
    { name: "Spa Sur", slug: "spa-sur", ownerEmail: "sur@spa.com", status: "suspended" as const, bookingEnabled: true, appointments30d: 0 },
  ];

  it("normaliza tildes y mayúsculas", () => {
    expect(normalizeSearch("  PeluQuería ")).toBe("peluqueria");
  });

  it("busca por nombre, slug o email y filtra por estado", () => {
    expect(filterTenants(rows, "peluqueria", "all").map((r) => r.slug)).toEqual(["zeka"]);
    expect(filterTenants(rows, "studio", "all").map((r) => r.slug)).toEqual(["nails-studio"]);
    expect(filterTenants(rows, "SPA.COM", "all").map((r) => r.slug)).toEqual(["spa-sur"]);
    expect(filterTenants(rows, "", "suspended").map((r) => r.slug)).toEqual(["spa-sur"]);
    expect(filterTenants(rows, "zeka", "trial")).toEqual([]);
    expect(filterTenants(rows, "", "all")).toHaveLength(3);
  });

  it("suma totales; un turnero prendido en un local apagado no cuenta", () => {
    expect(summarizeTenantRows(rows)).toEqual({ total: 3, active: 1, trial: 1, suspended: 1, bookingOn: 2, appointments30d: 13 });
    expect(summarizeTenantRows([])).toEqual({ total: 0, active: 0, trial: 0, suspended: 0, bookingOn: 0, appointments30d: 0 });
  });
});

describe("motivo y transiciones", () => {
  it("exige motivo al apagar", () => {
    expect(validateReason("", true)).toEqual({ ok: false, error: expect.any(String) });
    expect(validateReason(undefined, true).ok).toBe(false);
    expect(validateReason("abc", true).ok).toBe(false);
    expect(validateReason("  no   pagó\noctubre ", true)).toEqual({ ok: true, value: "no pagó octubre" });
  });

  it("el motivo es opcional al prender, pero si viene se valida", () => {
    expect(validateReason(undefined, false)).toEqual({ ok: true, value: null });
    expect(validateReason("   ", false)).toEqual({ ok: true, value: null });
    expect(validateReason("ok", false).ok).toBe(false);
    expect(validateReason("x".repeat(501), false).ok).toBe(false);
    expect(validateReason(42, false).ok).toBe(false);
  });

  it("planifica el cambio de estado desde el estado leído en el servidor", () => {
    expect(planStatusChange("active", "suspended")).toEqual({ ok: true, value: { from: "active", to: "suspended", action: "tenant.suspend" } });
    expect(planStatusChange("trial", "suspended")).toEqual({ ok: true, value: { from: "trial", to: "suspended", action: "tenant.suspend" } });
    expect(planStatusChange("suspended", "active")).toEqual({ ok: true, value: { from: "suspended", to: "active", action: "tenant.activate" } });
    expect(planStatusChange("trial", "active")).toEqual({ ok: true, value: { from: "trial", to: "active", action: "tenant.activate" } });
    expect(planStatusChange("suspended", "suspended").ok).toBe(false);
    expect(planStatusChange("active", "active").ok).toBe(false);
    expect(planStatusChange("active", "trial").ok).toBe(false);
    expect(planStatusChange("active", "deleted").ok).toBe(false);
  });

  it("planifica el cambio del turnero", () => {
    expect(planBookingChange(true, false)).toEqual({ ok: true, value: { from: "on", to: "off", action: "tenant.booking_off" } });
    expect(planBookingChange(false, true)).toEqual({ ok: true, value: { from: "off", to: "on", action: "tenant.booking_on" } });
    expect(planBookingChange(true, true).ok).toBe(false);
    expect(planBookingChange(true, "false").ok).toBe(false);
  });
});

describe("ids de auditoría", () => {
  it("ordenan alfabéticamente de más nuevo a más viejo", () => {
    const older = auditDocId(new Date("2026-01-01T00:00:00Z"), "aaa");
    const newer = auditDocId(new Date("2026-10-16T00:00:00Z"), "zzz");
    expect([older, newer].sort()).toEqual([newer, older]);
    expect(newer).toMatch(/^\d{13}_zzz$/);
  });

  it("limpian el sufijo para que sea un id válido", () => {
    expect(auditDocId(NOW, "a-b/c d")).toMatch(/^\d{13}_abcd$/);
    expect(auditDocId(NOW, "///")).toMatch(/^\d{13}_x$/);
  });
});

describe("fechas", () => {
  it("convierte Timestamps y Dates", () => {
    expect(toDateOrNull({ toDate: () => NOW })).toBe(NOW);
    expect(toDateOrNull(NOW)).toBe(NOW);
    expect(toDateOrNull(null)).toBeNull();
    expect(toDateOrNull("2026-10-16")).toBeNull();
    expect(toDateOrNull(new Date("x"))).toBeNull();
  });

  it("la ventana de N días incluye hoy y arranca a las 00:00 del local", () => {
    // 30 días con hoy (16/10) = desde el 17/09 00:00 en Buenos Aires = 03:00 UTC.
    expect(rollingWindowStart(30, TZ, NOW).toISOString()).toBe("2026-09-17T03:00:00.000Z");
    expect(rollingWindowStart(1, TZ, NOW).toISOString()).toBe("2026-10-16T03:00:00.000Z");
    expect(rollingWindowStart(7, TZ, NOW).toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });

  it("cuenta días calendario en la zona del local, no en UTC", () => {
    // 15/10 23:30 en Buenos Aires = 16/10 02:30 UTC: es "ayer" aunque en UTC sea el mismo día.
    expect(daysAgo(new Date("2026-10-16T02:30:00Z"), NOW, TZ)).toBe(1);
    expect(daysAgo(new Date("2026-10-16T03:30:00Z"), NOW, TZ)).toBe(0);
    expect(daysAgo(null, NOW, TZ)).toBeNull();
  });

  it("etiqueta la última actividad", () => {
    expect(relativeActivityLabel(null, NOW, TZ)).toBe("Sin turnos todavía");
    expect(relativeActivityLabel(new Date("2026-10-16T13:00:00Z"), NOW, TZ)).toBe("Hoy");
    expect(relativeActivityLabel(new Date("2026-10-15T13:00:00Z"), NOW, TZ)).toBe("Ayer");
    expect(relativeActivityLabel(new Date("2026-10-06T13:00:00Z"), NOW, TZ)).toBe("Hace 10 días");
    expect(relativeActivityLabel(new Date("2026-09-10T13:00:00Z"), NOW, TZ)).toBe("Hace 1 mes");
    expect(relativeActivityLabel(new Date("2026-06-01T13:00:00Z"), NOW, TZ)).toBe("Hace 4 meses");
    expect(relativeActivityLabel(new Date("2025-01-01T13:00:00Z"), NOW, TZ)).toBe("Hace más de un año");
  });

  it("colorea la actividad", () => {
    expect(activityTone(new Date("2026-10-14T13:00:00Z"), NOW, TZ)).toBe("confirmed");
    expect(activityTone(new Date("2026-10-01T13:00:00Z"), NOW, TZ)).toBe("draft");
    expect(activityTone(new Date("2026-08-01T13:00:00Z"), NOW, TZ)).toBe("alert");
    expect(activityTone(null, NOW, TZ)).toBe("alert");
  });

  it("formatea fechas en hora argentina", () => {
    expect(platformDateLabel(new Date("2026-10-16T02:30:00Z"))).toBe("15/10/2026");
    expect(platformDateLabel(null)).toBe("—");
  });
});

describe("plata", () => {
  it("formatea y compacta", () => {
    expect(formatMoney(1234567.4)).toBe("$1.234.567");
    expect(formatMoney(Number.NaN)).toBe("$0");
    expect(compactMoney(950_000)).toBe("$950.000");
    expect(compactMoney(1_250_000)).toBe("$1,25 M");
  });
});
