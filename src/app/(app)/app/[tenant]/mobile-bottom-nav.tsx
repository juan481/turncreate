"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { QuickActionsNavButton, useSpeedDial } from "./new-appointment-fab";
import { bottomNavTab, relativeTenantPath, type BottomNavTab } from "./route-meta";
import { TenantSwitcherMobile, type TenantOption } from "./tenant-switcher";

/**
 * Inicio · Agenda · (+) · Clientes · Más. Lo que se mira todo el día va
 * directo; el resto (Caja, Servicios, Reportes, Equipo, Configuración,
 * Ayuda) vive en la hoja "Más", que queda marcada en cualquiera de esas
 * pantallas (bottomNavTab() === "menu"). 5 slots de ~64px a 320px: los
 * labels son label-xs y truncan, nunca desbordan.
 */
const TABS = [
  { tab: "inicio", href: "", label: "Inicio", icon: "home" },
  { tab: "agenda", href: "agenda", label: "Agenda", icon: "calendar_month" },
  null,
  { tab: "clientes", href: "clientes", label: "Clientes", icon: "group" },
] as const;

type MoreItem = { href: string; label: string; icon: string };

function NavSlotContent({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <>
      {/* Indicador activo: pill tintada detrás del ícono (estilo M3). */}
      <span
        className={cn(
          "grid h-8 w-14 max-w-full place-items-center rounded-pill transition-colors duration-200",
          active ? "bg-secondary-soft text-primary" : "text-on-surface-variant",
        )}
      >
        <Icon name={icon} filled={active} className="text-[22px]" />
      </span>
      <span className={cn("max-w-full truncate font-label-xs text-label-xs", active ? "text-primary" : "text-on-surface-variant")}>{label}</span>
    </>
  );
}

const SLOT_CLASS =
  "flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 outline-none focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-primary/40";

const FOCUSED_FLOWS = new Set(["agenda/nuevo"]);

export function MobileBottomNav({
  tenantSlug,
  showStaff,
  signOutAction,
  tenantOptions,
  currentTenant,
}: {
  tenantSlug: string;
  /** Equipo solo si el plan admite más de una profesional. */
  showStaff: boolean;
  signOutAction: () => Promise<void>;
  tenantOptions?: TenantOption[];
  currentTenant: TenantOption;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const base = `/app/${tenantSlug}`;
  const activeTab: BottomNavTab | null = bottomNavTab(relativeTenantPath(pathname, tenantSlug));
  const dialToggleRef = useRef<HTMLButtonElement>(null);
  const dial = useSpeedDial(dialToggleRef);

  // Igual que el speed-dial: se guarda DÓNDE se abrió la hoja, así si la
  // ruta cambia por otro lado (atrás del navegador) se cierra sola, sin
  // un efecto con setState.
  const [moreOpenPath, setMoreOpenPath] = useState<string | null>(null);
  const moreOpen = moreOpenPath === pathname;

  // Si estás mirando un día puntual de la agenda y tocás "Nuevo turno",
  // el turno arranca en ESE día, no en hoy.
  const viewingAgendaDate = pathname === `${base}/agenda` ? searchParams.get("date") : null;
  const newAppointmentHref = `${base}/agenda/nuevo${viewingAgendaDate ? `?date=${viewingAgendaDate}` : ""}`;

  const moreItems: MoreItem[] = [
    { href: "caja", label: "Caja", icon: "point_of_sale" },
    { href: "servicios", label: "Servicios", icon: "content_cut" },
    { href: "reportes", label: "Reportes", icon: "monitoring" },
    ...(showStaff ? [{ href: "staff", label: "Equipo", icon: "badge" }] : []),
    { href: "configuracion", label: "Configuración", icon: "settings" },
    { href: "ayuda", label: "Ayuda", icon: "help" },
  ];

  // "Nuevo turno" es un flujo enfocado con su propia × y sus botones de
  // paso abajo: la barra fija los taparía ("Siguiente", "Crear turno").
  if (FOCUSED_FLOWS.has(relativeTenantPath(pathname, tenantSlug))) return null;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className={cn(
          "fixed inset-x-0 bottom-0 border-t border-border bg-surface-container-lowest/95 pb-[var(--safe-b)] backdrop-blur-xl lg:hidden",
          // Con el speed-dial abierto la barra sube por encima del velo
          // (z-[60]) para que el × quede nítido; el resto de la barra se
          // oscurece con su propio velo interno (abajo).
          dial.open ? "z-[70]" : "z-50",
        )}
      >
        <div className="relative mx-auto flex h-16 max-w-[30rem] items-stretch">
          {TABS.map((item) => {
            if (!item) {
              return <QuickActionsNavButton key="nuevo" base={base} newAppointmentHref={newAppointmentHref} dial={dial} toggleRef={dialToggleRef} />;
            }
            const href = item.href ? `${base}/${item.href}` : base;
            const active = activeTab === item.tab;
            return (
              <Link key={item.tab} href={href} aria-current={active ? "page" : undefined} className={SLOT_CLASS}>
                <NavSlotContent icon={item.icon} label={item.label} active={active} />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpenPath(pathname)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={SLOT_CLASS}
          >
            <NavSlotContent icon="more_horiz" label="Más" active={activeTab === "menu" || moreOpen} />
          </button>
        </div>
        {/* Velo de la barra misma (el del portal queda DEBAJO de ella):
            posicionado y sin z, así pinta sobre los ítems pero bajo el +
            (z-10). Tocarlo cierra, igual que el velo de la página. */}
        {dial.open && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar acciones rápidas"
            onClick={() => dial.setOpen(false)}
            className="absolute -top-px inset-x-0 bottom-0 bg-scrim/60 backdrop-blur-sm"
          />
        )}
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpenPath(null)} title="Más" variant="sheet">
        {tenantOptions && tenantOptions.length > 1 && (
          <div className="mb-md border-b border-border pb-md">
            <TenantSwitcherMobile current={currentTenant} options={tenantOptions} />
          </div>
        )}
        <nav aria-label="Más secciones" className="grid grid-cols-3 gap-2">
          {moreItems.map((item) => {
            const href = `${base}/${item.href}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.href}
                href={href}
                aria-current={active ? "page" : undefined}
                onNavigate={(event) => {
                  // Modal hizo history.pushState al abrir (para que el atrás
                  // del teléfono cierre la hoja) y al cerrarse hace
                  // history.back(). Si navegamos YA, ese back pisa el push y
                  // te devuelve. Entonces: cerrar, esperar a que el back
                  // aterrice (popstate, con tope de 350ms) y recién ahí ir.
                  event.preventDefault();
                  setMoreOpenPath(null);
                  if (pathname === href) return;
                  let done = false;
                  const go = () => {
                    if (done) return;
                    done = true;
                    window.removeEventListener("popstate", go);
                    router.push(href);
                  };
                  window.addEventListener("popstate", go);
                  window.setTimeout(go, 350);
                }}
                className={cn(
                  "flex min-h-[5.5rem] min-w-0 flex-col items-center justify-center gap-2 rounded-inner border px-1 py-3 text-center transition-colors active:bg-surface-container",
                  active ? "border-primary/30 bg-secondary-soft" : "border-border bg-surface-container-low",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full text-[20px]",
                    active ? "bg-primary text-on-primary" : "bg-surface-container-lowest text-secondary",
                  )}
                >
                  <Icon name={item.icon} />
                </span>
                <span className="w-full truncate font-label-md text-label-md text-on-surface">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-md border-t border-border pt-md">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-pill px-4 py-3 font-label-lg text-label-lg text-status-alert transition-colors hover:bg-status-alert-bg"
            >
              <Icon name="logout" className="text-[20px]" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </Modal>
    </>
  );
}
