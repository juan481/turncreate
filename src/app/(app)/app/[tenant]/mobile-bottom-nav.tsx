"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Inicio", icon: "home" },
  { href: "agenda", label: "Agenda", icon: "calendar_month" },
  { href: "clientes", label: "Clientes", icon: "group" },
  { href: "caja", label: "Caja", icon: "point_of_sale" },
  { href: "reportes", label: "Reportes", icon: "monitoring" },
];

export function MobileBottomNav({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-gutter pb-3 lg:hidden">
      <div className="mx-auto flex h-16 w-full max-w-[30rem] items-center justify-around rounded-pill border border-border bg-surface-container-lowest/95 shadow-card-hover backdrop-blur-xl">
        {ITEMS.map((item) => {
          const href = item.href ? `/app/${tenantSlug}/${item.href}` : `/app/${tenantSlug}`;
          const active = item.href ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 font-label-sm text-label-sm transition-colors",
                active ? "text-primary" : "text-on-surface-variant",
              )}
            >
              <Icon name={item.icon} filled={active} className="text-[22px]" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
