import Link from "next/link";
import { Icon } from "@/components/ui/icon";

/**
 * Solo desktop/tablet (lg+): en mobile el botón central de MobileBottomNav
 * ya cubre "nuevo turno" en cualquier pantalla, y tenerlo DEMÁS acá
 * encima duplicaba el botón flotante con el de la barra inferior.
 */
export function NewAppointmentFab({ tenantSlug }: { tenantSlug: string }) {
  return (
    <Link
      href={`/app/${tenantSlug}/agenda/nuevo`}
      className="fixed bottom-8 right-8 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95 lg:flex"
      aria-label="Nuevo turno"
      title="Nuevo turno"
    >
      <Icon name="add" className="text-[26px]" />
    </Link>
  );
}
