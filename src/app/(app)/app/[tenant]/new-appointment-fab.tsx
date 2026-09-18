import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function NewAppointmentFab({ tenantSlug }: { tenantSlug: string }) {
  return (
    <Link
      href={`/app/${tenantSlug}/agenda/nuevo`}
      className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-hover active:scale-95 lg:bottom-8 lg:right-8"
      aria-label="Nuevo turno"
      title="Nuevo turno"
    >
      <Icon name="add" className="text-[26px]" />
    </Link>
  );
}
