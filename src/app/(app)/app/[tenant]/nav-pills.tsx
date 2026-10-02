"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavPills({
  tenantSlug,
  items,
}: {
  tenantSlug: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 rounded-pill bg-surface-container-low/70 p-1 lg:flex">
      {items.map((item) => {
        const href = item.href ? `/app/${tenantSlug}/${item.href}` : `/app/${tenantSlug}`;
        const active = item.href
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === href;
        return (
          <Link
            key={item.label}
            href={href}
            data-tour={item.href || "inicio"}
            className={cn(
              "rounded-pill px-4 py-2 font-label-md text-label-md transition-all duration-200",
              active
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
