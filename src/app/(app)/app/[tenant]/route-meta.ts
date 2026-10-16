/**
 * Título del AppBar y padre jerárquico de cada pantalla del admin.
 *
 * El "Volver" del header va SIEMPRE al padre de esta tabla, nunca al
 * historial: entrar a Agenda → Clientes → Caja y tocar Volver tiene que
 * llevar a Inicio, no deshacer los pasos (el back del navegador sigue
 * siendo historial, eso es aparte).
 *
 * Las claves son el path relativo a /app/[tenant]; `:id` matchea un
 * segmento cualquiera. `parent` también es relativo ("" = Inicio).
 */
export type RouteMeta = { title: string; parent: string | null };

const HOME: RouteMeta = { title: "Inicio", parent: null };

const ROUTES: Record<string, RouteMeta> = {
  agenda: { title: "Agenda", parent: "" },
  clientes: { title: "Clientes", parent: "" },
  servicios: { title: "Servicios", parent: "" },
  caja: { title: "Caja", parent: "" },
  reportes: { title: "Reportes", parent: "" },
  configuracion: { title: "Configuración", parent: "" },
  ayuda: { title: "Ayuda", parent: "" },
  novedades: { title: "Novedades", parent: "" },
  tutorial: { title: "Cómo funciona", parent: "" },
  bot: { title: "IA", parent: "" },

  "agenda/semana": { title: "Semana", parent: "agenda" },
  "agenda/mes": { title: "Calendario", parent: "agenda" },
  "agenda/nuevo": { title: "Nuevo turno", parent: "agenda" },
  "agenda/:id": { title: "Detalle del turno", parent: "agenda" },
  "clientes/:id": { title: "Ficha de cliente", parent: "clientes" },
  "servicios/nuevo": { title: "Nuevo servicio", parent: "servicios" },
  "servicios/:id": { title: "Editar servicio", parent: "servicios" },
  // Pestaña hermana de Caja, no una pantalla "adentro" de la caja del día.
  "caja/historial": { title: "Historial", parent: "" },
  "configuracion/local": { title: "Información del local", parent: "configuracion" },
  "configuracion/horarios": { title: "Horarios", parent: "configuracion" },
  "configuracion/pagos": { title: "Pagos y señas", parent: "configuracion" },
  staff: { title: "Equipo", parent: "configuracion" },
};

const PATTERNS = Object.entries(ROUTES)
  .filter(([key]) => key.includes(":id"))
  .map(([key, meta]) => ({ segments: key.split("/"), meta }));

function matchPattern(segments: string[]): RouteMeta | null {
  for (const pattern of PATTERNS) {
    if (pattern.segments.length !== segments.length) continue;
    if (pattern.segments.every((seg, i) => seg === ":id" || seg === segments[i])) return pattern.meta;
  }
  return null;
}

/** `relativePath`: lo que viene después de /app/[tenant]/ (ej. "agenda/semana"). */
export function routeMeta(relativePath: string): RouteMeta {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return HOME;

  const exact = ROUTES[segments.join("/")];
  if (exact) return exact;
  const dynamic = matchPattern(segments);
  if (dynamic) return dynamic;

  // Ruta sin registrar: sube un nivel y hereda el título de su sección.
  const parent = segments.slice(0, -1).join("/");
  return { title: segments.length === 1 ? "TurnCreate" : routeMeta(parent).title, parent };
}

export function relativeTenantPath(pathname: string, tenantSlug: string): string {
  const base = `/app/${tenantSlug}`;
  if (pathname === base || !pathname.startsWith(`${base}/`)) return "";
  return pathname.slice(base.length + 1).replace(/\/+$/, "");
}

/** Título + href absoluto del Volver (null en Inicio) para un pathname real. */
export function resolveTenantRoute(pathname: string, tenantSlug: string) {
  const base = `/app/${tenantSlug}`;
  const relative = relativeTenantPath(pathname, tenantSlug);
  const meta = routeMeta(relative);
  const backHref = meta.parent === null ? null : meta.parent ? `${base}/${meta.parent}` : base;
  return { relative, title: meta.title, backHref };
}

export type BottomNavTab = "inicio" | "agenda" | "clientes" | "menu";

const MENU_SECTIONS = new Set(["caja", "reportes", "servicios", "staff", "configuracion", "ayuda", "novedades", "tutorial", "bot"]);

/** Qué pestaña de la barra inferior queda marcada en cada ruta. */
export function bottomNavTab(relativePath: string): BottomNavTab | null {
  const section = relativePath.split("/").filter(Boolean)[0];
  if (!section) return "inicio";
  if (section === "agenda") return "agenda";
  if (section === "clientes") return "clientes";
  if (MENU_SECTIONS.has(section)) return "menu";
  return null;
}
