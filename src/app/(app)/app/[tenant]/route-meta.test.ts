import { describe, expect, it } from "vitest";
import { bottomNavTab, relativeTenantPath, resolveTenantRoute, routeMeta } from "./route-meta";

describe("routeMeta", () => {
  it("la home no tiene padre", () => {
    expect(routeMeta("")).toEqual({ title: "Inicio", parent: null });
  });

  it.each([
    ["agenda", "Agenda"],
    ["clientes", "Clientes"],
    ["servicios", "Servicios"],
    ["caja", "Caja"],
    ["reportes", "Reportes"],
    ["configuracion", "Configuración"],
    ["ayuda", "Ayuda"],
    ["novedades", "Novedades"],
    ["tutorial", "Cómo funciona"],
    ["bot", "IA"],
  ])("1er nivel %s vuelve a Inicio", (path, title) => {
    expect(routeMeta(path)).toEqual({ title, parent: "" });
  });

  it.each([
    ["agenda/semana", "Semana", "agenda"],
    ["agenda/mes", "Calendario", "agenda"],
    ["agenda/nuevo", "Nuevo turno", "agenda"],
    ["agenda/abc123", "Detalle del turno", "agenda"],
    ["clientes/xyz", "Ficha de cliente", "clientes"],
    ["servicios/nuevo", "Nuevo servicio", "servicios"],
    ["servicios/srv_1", "Editar servicio", "servicios"],
    ["configuracion/local", "Información del local", "configuracion"],
    ["configuracion/horarios", "Horarios", "configuracion"],
    ["configuracion/pagos", "Pagos y señas", "configuracion"],
    ["staff", "Equipo", "configuracion"],
  ])("%s → %s, padre %s", (path, title, parent) => {
    expect(routeMeta(path)).toEqual({ title, parent });
  });

  it("el historial de caja es hermano de Caja: vuelve a Inicio", () => {
    expect(routeMeta("caja/historial")).toEqual({ title: "Historial", parent: "" });
  });

  it("las rutas estáticas le ganan al :id", () => {
    expect(routeMeta("agenda/nuevo").title).toBe("Nuevo turno");
    expect(routeMeta("agenda/semana").title).toBe("Semana");
  });

  it("una ruta más profunda sin registrar sube un nivel y hereda el título", () => {
    expect(routeMeta("clientes/xyz/editar")).toEqual({ title: "Ficha de cliente", parent: "clientes/xyz" });
    expect(routeMeta("configuracion/avanzado")).toEqual({ title: "Configuración", parent: "configuracion" });
  });

  it("una sección desconocida vuelve a Inicio", () => {
    expect(routeMeta("algo-nuevo")).toEqual({ title: "TurnCreate", parent: "" });
  });
});

describe("relativeTenantPath", () => {
  it("saca el prefijo del tenant y la barra final", () => {
    expect(relativeTenantPath("/app/lu-nails", "lu-nails")).toBe("");
    expect(relativeTenantPath("/app/lu-nails/agenda/mes/", "lu-nails")).toBe("agenda/mes");
  });

  it("no confunde un slug que empieza igual", () => {
    expect(relativeTenantPath("/app/lu-nails-2/agenda", "lu-nails")).toBe("");
  });
});

describe("resolveTenantRoute", () => {
  it("arma el href absoluto del padre", () => {
    expect(resolveTenantRoute("/app/lu/agenda/abc", "lu")).toMatchObject({ title: "Detalle del turno", backHref: "/app/lu/agenda" });
    expect(resolveTenantRoute("/app/lu/caja", "lu")).toMatchObject({ backHref: "/app/lu" });
    expect(resolveTenantRoute("/app/lu/staff", "lu")).toMatchObject({ title: "Equipo", backHref: "/app/lu/configuracion" });
    expect(resolveTenantRoute("/app/lu", "lu")).toMatchObject({ title: "Inicio", backHref: null });
  });
});

describe("bottomNavTab", () => {
  it.each([
    ["", "inicio"],
    ["agenda", "agenda"],
    ["agenda/abc", "agenda"],
    ["clientes/xyz", "clientes"],
    ["caja/historial", "menu"],
    ["reportes", "menu"],
    ["staff", "menu"],
    ["novedades", "menu"],
    ["desconocida", null],
  ])("%s → %s", (path, tab) => {
    expect(bottomNavTab(path)).toBe(tab);
  });
});
