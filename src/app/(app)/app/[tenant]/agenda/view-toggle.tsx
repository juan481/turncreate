import Link from "next/link";
import { cn } from "@/lib/utils";

export function ViewToggle({
  tenantSlug,
  dateISO,
  active,
}: {
  tenantSlug: string;
  dateISO: string;
  active: "day" | "week";
}) {
  const tabs = [
    { key: "day" as const, label: "Día", href: `/app/${tenantSlug}/agenda?date=${dateISO}` },
    { key: "week" as const, label: "Semana", href: `/app/${tenantSlug}/agenda/semana?date=${dateISO}` },
  ];

  return (
    <div className="flex items-center gap-1 rounded-pill bg-surface-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "rounded-pill px-4 py-1.5 font-label-md text-label-md",
            active === tab.key
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:text-on-surface",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
