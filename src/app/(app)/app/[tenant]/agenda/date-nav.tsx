import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Icon } from "@/components/ui/icon";

export function DateNav({ tenantSlug, dateISO }: { tenantSlug: string; dateISO: string }) {
  const date = parseISO(dateISO);
  const prevISO = format(addDays(date, -1), "yyyy-MM-dd");
  const nextISO = format(addDays(date, 1), "yyyy-MM-dd");
  const label = format(date, "EEEE, d 'de' MMMM", { locale: es });

  return (
    <div className="flex items-center gap-1 rounded-pill bg-surface-container p-1 shadow-sm">
      <Link
        href={`/app/${tenantSlug}/agenda?date=${prevISO}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        aria-label="Día anterior"
      >
        <Icon name="chevron_left" className="text-[18px]" />
      </Link>
      <div className="flex items-center gap-1.5 px-3 font-headline-sm text-headline-sm capitalize text-on-surface">
        <Icon name="calendar_today" className="text-[18px] text-secondary" />
        {label}
      </div>
      <Link
        href={`/app/${tenantSlug}/agenda?date=${nextISO}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high"
        aria-label="Día siguiente"
      >
        <Icon name="chevron_right" className="text-[18px]" />
      </Link>
    </div>
  );
}
