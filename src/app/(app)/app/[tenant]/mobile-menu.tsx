"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export function MobileMenuButton({
  tenantSlug,
  items,
  signOutAction,
}: {
  tenantSlug: string;
  items: { href: string; label: string; icon: string }[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container lg:hidden"
        aria-label="Abrir menú"
      >
        <Icon name="menu" className="text-[22px]" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Menú" variant="sheet">
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const href = item.href ? `/app/${tenantSlug}/${item.href}` : `/app/${tenantSlug}`;
            const active = item.href
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname === href;
            return (
              <Link
                key={item.label}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-pill px-4 py-3 font-label-lg text-label-lg transition-colors",
                  active
                    ? "bg-primary text-on-primary"
                    : "text-on-surface hover:bg-surface-container-low",
                )}
              >
                <Icon name={item.icon} className="text-[20px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-md border-t border-border pt-md">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-pill px-4 py-3 font-label-lg text-label-lg text-status-alert transition-colors hover:bg-status-alert-bg"
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
