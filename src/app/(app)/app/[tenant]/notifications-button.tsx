"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { AppNotification } from "@/lib/app-notification";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

function playNotificationSound(audio: AudioContext) {
  const now = audio.currentTime;
  [0, 0.16].forEach((offset, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 0 ? 660 : 820;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.15);
  });
}

export function NotificationsButton({ tenantSlug, initialNotifications }: { tenantSlug: string; initialNotifications: AppNotification[] }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unread, setUnread] = useState(0);
  const [soundReady, setSoundReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set(initialNotifications.map((item) => item.id)));
  const soundReadyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const pendingSoundIdRef = useRef<string | null>(null);
  const soundKey = `turncreate:last-sound:${tenantSlug}`;

  useEffect(() => {
    function enableSound() {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass && !audioRef.current) audioRef.current = new AudioContextClass();
      if (audioRef.current?.state === "suspended") void audioRef.current.resume();
      soundReadyRef.current = true;
      setSoundReady(true);
      const pendingId = pendingSoundIdRef.current;
      if (pendingId && audioRef.current && window.localStorage.getItem(soundKey) !== pendingId) {
        window.localStorage.setItem(soundKey, pendingId);
        pendingSoundIdRef.current = null;
        playNotificationSound(audioRef.current);
      }
    }
    document.addEventListener("pointerdown", enableSound, { once: true });
    document.addEventListener("keydown", enableSound, { once: true });
    return () => {
      document.removeEventListener("pointerdown", enableSound);
      document.removeEventListener("keydown", enableSound);
    };
  }, [soundKey]);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/app/${encodeURIComponent(tenantSlug)}/notifications`, { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as { notifications?: AppNotification[] };
        if (!active || !Array.isArray(body.notifications)) return;
        const fresh = body.notifications.filter((item) => !knownIds.current.has(item.id));
        body.notifications.forEach((item) => knownIds.current.add(item.id));
        setNotifications(body.notifications);
        if (fresh.length > 0) {
          setUnread((value) => value + fresh.length);
          const newest = fresh[0].id;
          if (soundReadyRef.current && audioRef.current && window.localStorage.getItem(soundKey) !== newest) {
            window.localStorage.setItem(soundKey, newest);
            playNotificationSound(audioRef.current);
          } else if (!soundReadyRef.current) pendingSoundIdRef.current = newest;
        }
      } catch {
        // La campana conserva la última lectura si el dispositivo queda sin red.
      }
    }
    const timer = window.setInterval(refresh, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [soundKey, tenantSlug]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((value) => { const next = !value; if (next) setUnread(0); return next; })} className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface" aria-label={unread > 0 ? `Notificaciones, ${unread} nuevas` : "Notificaciones"} aria-expanded={open}>
        <Icon name="notifications" className="text-[20px]" />
        {unread > 0 && <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-status-alert-dot px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface-container-lowest">{Math.min(unread, 9)}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1rem))] animate-fade-up rounded-card border border-border bg-surface-container-lowest p-md text-on-surface shadow-card-hover">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div><p className="font-label-lg text-label-lg">Notificaciones</p><p className="font-body-sm text-body-sm text-on-surface-variant">Últimas 48 horas</p></div>
            <span className="flex items-center gap-1 rounded-pill bg-surface-container-low px-2 py-1 font-label-sm text-label-sm text-on-surface-variant"><Icon name={soundReady ? "notifications_active" : "notifications_off"} className="text-[14px]" />{soundReady ? "Sonido activo" : "Tocá para activar"}</span>
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center"><Icon name="notifications_off" className="text-[24px] text-on-surface-variant" /><p className="font-body-sm text-body-sm text-on-surface-variant">No hay novedades recientes.</p></div>
          ) : (
            <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
              {notifications.map((item) => (
                <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-2.5 rounded-inner p-2 transition-colors hover:bg-surface-container-low">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${item.color}1a`, color: item.color }}><Icon name={item.icon} className="text-[16px]" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-label-md text-label-md">{item.title}</span><span className="block truncate font-body-sm text-body-sm text-on-surface-variant">{item.detail}</span></span>
                  <span className="shrink-0 font-label-sm text-label-sm text-on-surface-variant">{timeAgo(item.at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{unread > 0 ? `${unread} notificaciones nuevas` : ""}</span>
    </div>
  );
}
