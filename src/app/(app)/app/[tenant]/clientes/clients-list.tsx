"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ClientRow = {
  id: string;
  full_name: string;
  phone_e164: string;
  email: string | null;
  no_show_count: number;
  lastVisitAt: string | null;
};

const SORTS = [
  { key: "name" as const, label: "Nombre" },
  { key: "recent" as const, label: "Última visita" },
];

export function ClientsList({ tenantSlug, clients }: { tenantSlug: string; clients: ClientRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "recent">("name");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? clients.filter(
          (c) => c.full_name.toLowerCase().includes(q) || c.phone_e164.includes(q) || c.email?.toLowerCase().includes(q),
        )
      : clients;

    const sorted = [...matches];
    if (sort === "name") {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, "es"));
    } else {
      sorted.sort((a, b) => {
        if (!a.lastVisitAt && !b.lastVisitAt) return 0;
        if (!a.lastVisitAt) return 1;
        if (!b.lastVisitAt) return -1;
        return b.lastVisitAt.localeCompare(a.lastVisitAt);
      });
    }
    return sorted;
  }, [clients, query, sort]);

  return (
    <div className="space-y-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Icon
            name="search"
            className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email…"
            className="!pl-11"
          />
        </div>
        <div className="flex items-center gap-1 self-start rounded-pill bg-surface-container-low p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                "rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all duration-200",
                sort === s.key ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card hoverLift={false} className="divide-y divide-border p-0">
        {filtered.map((client) => (
          <Link
            key={client.id}
            href={`/app/${tenantSlug}/clientes/${client.id}`}
            className="flex items-center gap-3 px-lg py-3 transition-colors hover:bg-surface-container-low"
          >
            <Avatar name={client.full_name} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-label-lg text-label-lg text-on-surface">{client.full_name}</p>
              <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {client.phone_e164}
                {client.email && ` · ${client.email}`}
              </p>
            </div>
            {sort === "recent" && client.lastVisitAt && (
              <span className="hidden shrink-0 font-label-sm text-label-sm text-on-surface-variant sm:inline">
                {new Date(client.lastVisitAt).toLocaleDateString("es-AR")}
              </span>
            )}
            {client.no_show_count > 0 && (
              <StatusPill status="alert" className="shrink-0">
                {client.no_show_count} ausencias
              </StatusPill>
            )}
            <Icon name="chevron_right" className="shrink-0 text-[18px] text-on-surface-variant" />
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="px-lg py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
            {clients.length === 0 ? "Todavía no hay clientes cargados." : "No hay clientes que coincidan con la búsqueda."}
          </p>
        )}
      </Card>
    </div>
  );
}
