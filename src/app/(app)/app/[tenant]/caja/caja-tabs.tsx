import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type CajaTab = "hoy" | "historial" | "reportes";

/**
 * Control segmentado de Caja: Hoy · Historial · Reportes. Son LINKS (cada
 * pestaña es una ruta propia, el atrás del teléfono funciona), así que se
 * marca la activa con `aria-current="page"` en vez de role="tab". Tres
 * columnas iguales con `min-w-0` + `truncate`: a 320px cada una mide ~90px
 * y no hay scroll lateral. Cada target mide 44px (h-11).
 */
export function CajaTabs({ tenantSlug, active }: { tenantSlug: string; active: CajaTab }) {
  const base = `/app/${tenantSlug}`;
  const tabs: { id: CajaTab; label: string; href: string; icon: string }[] = [
    { id: "hoy", label: "Hoy", href: `${base}/caja`, icon: "point_of_sale" },
    { id: "historial", label: "Historial", href: `${base}/caja/historial`, icon: "history" },
    { id: "reportes", label: "Reportes", href: `${base}/reportes`, icon: "bar_chart" },
  ];

  return (
    <nav aria-label="Secciones de caja">
      <ul className="grid grid-cols-3 gap-1 rounded-pill bg-surface-container p-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-pill px-2 font-label-md text-label-md transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
                  isActive
                    ? "bg-surface text-on-surface shadow-card"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                )}
              >
                <Icon name={tab.icon} className="hidden text-[16px] min-[400px]:inline" />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
