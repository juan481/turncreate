"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppBar } from "@/components/ui/app-bar";
import { Logo } from "@/components/ui/logo";
import { NotificationsButton } from "./notifications-button";
import { Icon } from "@/components/ui/icon";

// Título de cada sección de 1er nivel (/app/[tenant]/<sección>). El
// detalle de un turno/cliente/servicio (2do nivel) muestra el mismo
// título que su sección -- el nombre puntual del registro ya es
// protagonista dentro de la pantalla, no hace falta repetirlo en el
// header para no tener que pasar datos del servidor hasta este client
// component solo para eso.
const SECTION_TITLE: Record<string, string> = {
  agenda: "Agenda",
  clientes: "Clientes",
  servicios: "Servicios",
  staff: "Equipo",
  caja: "Caja",
  reportes: "Reportes",
  bot: "IA",
  configuracion: "Configuración",
};

// Vistas alternativas de una sección (no son "detalle de un registro",
// son hermanas de la vista principal) -- título propio, pero el back
// sigue yendo a la sección igual que cualquier 2do nivel.
const SUB_TITLE: Record<string, string> = {
  "agenda/nuevo": "Nuevo turno",
  "agenda/semana": "Semana",
  "agenda/mes": "Calendario",
};

export function MobilePageHeader({ tenantSlug, tenantName }: { tenantSlug: string; tenantName: string }) {
  const pathname = usePathname();
  const base = `/app/${tenantSlug}`;
  const rest = pathname === base ? "" : pathname.slice(base.length + 1);
  const segments = rest.split("/").filter(Boolean);
  const supportHref = `https://wa.me/541124527669?text=${encodeURIComponent(`Hola, necesito ayuda con ${tenantName} (${tenantSlug}) en TurnCreate.`)}`;
  const support = <a href={supportHref} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full text-on-primary" aria-label="Ayuda por WhatsApp"><Icon name="help" className="text-[22px]" /></a>;

  if (segments.length === 0) {
    return (
      <AppBar
        left={
          <Link href={base} className="flex min-w-0 flex-1 items-center gap-2">
            <Logo iconOnly className="h-7 w-7 shrink-0" />
            <span className="truncate font-headline-sm text-headline-sm text-on-primary">{tenantName}</span>
          </Link>
        }
        right={<>{support}<NotificationsButton notifications={[]} /></>}
      />
    );
  }

  const section = segments[0];
  const title = SUB_TITLE[rest] ?? SECTION_TITLE[section] ?? "TurnCreate";
  const backHref = segments.length > 1 ? `${base}/${section}` : base;
  return <AppBar title={title} backHref={backHref} right={support} />;
}
