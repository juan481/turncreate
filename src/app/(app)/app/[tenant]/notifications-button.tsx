"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";

type AppNotification = { id: string; icon: string; color: string; title: string; detail: string; at: string };

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function NotificationsButton({ notifications = [] }: { notifications?: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
        aria-label="Notificaciones"
      >
        <Icon name="notifications" className="text-[20px]" />
        {notifications.length > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary ring-2 ring-surface-container-lowest" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 animate-fade-up rounded-card border border-border bg-surface-container-lowest p-md shadow-card-hover">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-label-lg text-label-lg text-on-surface">Notificaciones</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Últimas 48 hs</span>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Icon name="notifications_off" className="text-[24px] text-on-surface-variant" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Sin novedades: nada nuevo, cancelado ni con poco stock.
              </p>
            </div>
          ) : (
            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 rounded-inner p-2 hover:bg-surface-container-low">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${n.color}1a`, color: n.color }}
                  >
                    <Icon name={n.icon} className="text-[16px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md text-label-md text-on-surface">{n.title}</p>
                    <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{n.detail}</p>
                  </div>
                  <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">{timeAgo(n.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
