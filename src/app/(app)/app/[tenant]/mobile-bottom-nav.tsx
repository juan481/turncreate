"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * 4 secciones + "Nuevo turno" al centro -- lo que se mira todo el día.
 * Todo lo demás (Reportes, Servicios, Equipo, Configuración, IA) se
 * llega desde la botonera de la home, no desde acá: con 5-8 ítems el
 * texto no entraba sin desbordar el contenedor ("Reportes" se salía) y
 * cada ícono quedaba apretado. Barra chata (no pill flotante) a todo el
 * ancho, con el inset de abajo real del teléfono.
 */
const ITEMS = [
  { href: "", label: "Inicio", icon: "home" },
  { href: "agenda", label: "Agenda", icon: "calendar_month" },
  null,
  { href: "clientes", label: "Clientes", icon: "group" },
  { href: "caja", label: "Caja", icon: "point_of_sale" },
] as const;

export function MobileBottomNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/app/${tenantSlug}`;

  // Si estás mirando un día puntual de la agenda y tocás "+", el turno
  // nuevo arranca en ESE día -- antes el botón de nuevo turno siempre
  // mandaba a "hoy" sin importar qué día tenías abierto.
  const viewingAgendaDate = pathname === `${base}/agenda` ? searchParams.get("date") : null;
  const newAppointmentHref = `${base}/agenda/nuevo${viewingAgendaDate ? `?date=${viewingAgendaDate}` : ""}`;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface-container-lowest/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "var(--safe-b)" }}
    >
      <div className="mx-auto flex max-w-[30rem] items-stretch justify-around">
        {ITEMS.map((item) => {
          if (!item) {
            return (
              <Link
                key="nuevo-turno"
                href={newAppointmentHref}
                aria-label="Nuevo turno"
                className="relative flex flex-1 flex-col items-center justify-end pb-1.5"
              >
                <span className="absolute -top-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-card-hover transition-transform active:scale-95">
                  <Icon name="add" className="text-[24px]" />
                </span>
              </Link>
            );
          }
          const href = item.href ? `${base}/${item.href}` : base;
          const active = item.href ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return (
            <Link
              key={item.href || "inicio"}
              href={href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 font-label-xs text-label-xs transition-colors",
                active ? "text-primary" : "text-on-surface-variant",
              )}
            >
              <Icon name={item.icon} filled={active} className="shrink-0 text-[22px]" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
