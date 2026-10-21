"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const ITEMS = [
  { href: "#producto", label: "Producto" },
  { href: "#personalizacion", label: "Personalización" },
  { href: "#integraciones", label: "Integraciones" },
  { href: "#planes", label: "Planes" },
];

export function MarketingMobileMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative lg:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface transition-all hover:bg-secondary-soft hover:text-primary active:scale-95"
      >
        <Icon name={open ? "close" : "menu"} className="text-[19px]" />
      </button>
      {open && (
        <div className="marketing-menu-panel absolute right-0 top-12 w-[min(82vw,300px)] rounded-[1.5rem] border border-border bg-white/95 p-3 shadow-card-hover backdrop-blur-2xl">
          <nav aria-label="Navegación móvil" className="flex flex-col">
            {ITEMS.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center justify-between rounded-xl px-3 text-[13px] font-semibold text-on-surface transition-colors hover:bg-secondary-soft hover:text-primary">
                {item.label}<Icon name="arrow_forward" className="text-[14px]" />
              </a>
            ))}
          </nav>
          <div className="mt-2 grid gap-2 border-t border-border pt-3">
            <Link href="/login" className={buttonVariants({ variant: "secondary" })}>Iniciar sesión</Link>
            <Link href="/registro" className={buttonVariants()}>Probar gratis 7 días</Link>
          </div>
        </div>
      )}
    </div>
  );
}
