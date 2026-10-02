"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type TenantOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
  logoUrl?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Propietario/a",
  admin: "Admin",
  receptionist: "Recepción",
  professional: "Profesional",
};

export function TenantSwitcher({
  current,
  options,
}: {
  current: TenantOption;
  options: TenantOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Single tenant — show plain badge, no dropdown
  if (options.length <= 1) {
    return (
      <div className="hidden items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant xl:flex">
        {current.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo elegido por el dueño del local, URL externa
          <img src={current.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed-dot" />
        )}
        {current.name}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative hidden xl:block">
      <button
        type="button"
        data-tour="tenant-switcher"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 font-label-sm text-label-sm transition-all",
          open
            ? "border-primary bg-primary/10 text-primary"
            : "border-transparent bg-surface-container-low text-on-surface-variant hover:border-outline-variant hover:bg-surface-container",
        )}
      >
        {current.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo elegido por el dueño del local, URL externa
          <img src={current.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed-dot" />
        )}
        <span className="max-w-[12rem] truncate">{current.name}</span>
        <Icon
          name="expand_more"
          className={cn("text-[16px] transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[200] mt-2 w-56 overflow-hidden rounded-card border border-border bg-surface-container-lowest shadow-card-hover">
          <div className="px-3 py-2">
            <p className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider">
              Tus locales
            </p>
          </div>
          <div className="border-t border-border">
            {options.map((opt) => {
              const isActive = opt.slug === current.slug;
              return (
                <Link
                  key={opt.id}
                  href={`/app/${opt.slug}`}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface hover:bg-surface-container-low",
                  )}
                >
                  {opt.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- logo elegido por el dueño del local, URL externa
                    <img src={opt.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-inner object-cover" />
                  ) : (
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-inner text-[11px] font-semibold",
                        isActive
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface-variant",
                      )}
                    >
                      {opt.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-label-sm text-label-sm">{opt.name}</p>
                    <p className="font-label-xs text-label-xs text-on-surface-variant">
                      {ROLE_LABEL[opt.role] ?? opt.role}
                    </p>
                  </div>
                  {isActive && <Icon name="check" className="text-[16px] text-primary" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Mobile version: shows in the mobile menu sheet */
export function TenantSwitcherMobile({
  current,
  options,
}: {
  current: TenantOption;
  options: TenantOption[];
}) {
  if (options.length <= 1) return null;

  return (
    <div className="space-y-1">
      <p className="px-1 font-label-xs text-label-xs uppercase tracking-wider text-on-surface-variant">
        Cambiar local
      </p>
      {options.map((opt) => {
        const isActive = opt.slug === current.slug;
        return (
          <Link
            key={opt.id}
            href={`/app/${opt.slug}`}
            className={cn(
              "flex items-center gap-3 rounded-pill px-3 py-2 font-label-md text-label-md transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
            )}
          >
            {opt.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo elegido por el dueño del local, URL externa
              <img src={opt.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-inner object-cover" />
            ) : <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-inner text-[11px] font-semibold",
                isActive ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant",
              )}
            >
              {opt.name.slice(0, 2).toUpperCase()}
            </span>}
            <span className="flex-1 truncate">{opt.name}</span>
            {isActive && <Icon name="check" className="text-[16px]" />}
          </Link>
        );
      })}
    </div>
  );
}
