"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/platform", label: "Locales", icon: "storefront" },
  { href: "/platform/auditoria", label: "Auditoría", icon: "history" },
] as const;

/** Pestañas de la consola. "Locales" queda marcada también en el detalle de un local. */
export function PlatformNav() {
  const pathname = usePathname();
  const activeHref = pathname.startsWith("/platform/auditoria") ? "/platform/auditoria" : "/platform";
  return (
    <nav aria-label="Secciones de la consola" className="mx-auto flex w-full max-w-[80rem] gap-1 px-gutter pb-2">
      {TABS.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 min-w-0 items-center gap-1.5 rounded-pill px-4 font-label-md text-label-md transition-colors",
              active ? "bg-white text-primary" : "text-white/80 hover:bg-white/15 active:bg-white/20",
            )}
          >
            <Icon name={tab.icon} className="text-[16px]" />
            <span className="truncate">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
