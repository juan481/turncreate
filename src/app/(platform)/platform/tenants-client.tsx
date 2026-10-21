"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  STATUS_FILTERS,
  TENANT_STATUS_LABEL,
  filterTenants,
  tenantStatusTone,
  type StatusFilter,
} from "@/server/platform/model";
import type { PlatformTenantRow } from "@/server/platform/stats";

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: "Todos",
  active: "Activos",
  trial: "En prueba",
  suspended: "Apagados",
  demo: "Demo",
};

function OnOff({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return <StatusDot tone={on ? "confirmed" : "neutral"}>{on ? onLabel : offLabel}</StatusDot>;
}

/**
 * Listado de locales: búsqueda (nombre, URL, email de la dueña) + filtro
 * por estado. Cards debajo de lg, tabla en lg+. Solo muestra: apagar y
 * prender se hace desde el detalle, con confirmación y motivo.
 */
export function TenantsClient({ tenants }: { tenants: PlatformTenantRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const visible = useMemo(() => filterTenants(tenants, query, status), [tenants, query, status]);
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = { all: tenants.length, active: 0, trial: 0, suspended: 0, demo: 0 };
    for (const tenant of tenants) result[tenant.status] += 1;
    return result;
  }, [tenants]);

  return (
    <section aria-labelledby="locales-title" className="space-y-md">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 id="locales-title" className="font-headline-sm text-headline-sm text-on-surface">
          Locales registrados
        </h2>
        <div className="relative w-full min-w-0 lg:max-w-[22rem]">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, URL o email"
            aria-label="Buscar local por nombre, URL o email de la dueña"
            className="pl-11"
          />
        </div>
      </div>

      <div role="group" aria-label="Filtrar por estado" className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 lg:mx-0 lg:px-0">
        {STATUS_FILTERS.map((filter) => {
          const active = filter === status;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(filter)}
              className={cn(
                "flex h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 font-label-md text-label-md transition-colors",
                active
                  ? "border-transparent bg-primary text-on-primary"
                  : "border-border bg-surface text-on-surface hover:bg-surface-muted",
              )}
            >
              {FILTER_LABEL[filter]}
              <span className={cn("tabular-nums", active ? "text-on-primary/80" : "text-on-surface-variant")}>{counts[filter]}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-card border border-border bg-surface">
          <EmptyState
            icon={<Icon name="storefront" />}
            title={tenants.length === 0 ? "Todavía no hay locales" : "No hay locales con ese filtro"}
            description={tenants.length === 0 ? "Cuando alguien se registre, lo vas a ver acá." : "Probá con otra búsqueda o cambiá el estado."}
          />
        </div>
      ) : (
        <>
          {/* Mobile / tablet: cards. La card entera lleva al detalle; el link al turnero va aparte (no se anidan <a>). */}
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
            {visible.map((tenant) => (
              <li key={tenant.id} className="flex min-w-0 items-stretch overflow-hidden rounded-inner border border-border bg-surface-container-lowest shadow-card">
                <Link
                  href={`/platform/${tenant.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-2 p-3.5 transition-colors active:bg-surface-container-low"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-label-lg text-label-lg text-on-surface">{tenant.name}</p>
                      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">/{tenant.slug} · {tenant.plan}</p>
                    </div>
                    <StatusDot tone={tenantStatusTone(tenant.status)} className="shrink-0">
                      {TENANT_STATUS_LABEL[tenant.status]}
                    </StatusDot>
                  </div>
                  <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                    {tenant.ownerEmail ?? "Sin dueña registrada"}
                  </p>
                  <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1">
                    <OnOff on={tenant.bookingEnabled} onLabel="Turnero on" offLabel="Turnero off" />
                    <OnOff on={tenant.mpConnected} onLabel="MP conectado" offLabel="Sin MP" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 border-t border-border pt-2">
                    <div className="min-w-0">
                      <p className="font-label-xs text-label-xs text-on-surface-variant">Turnos 30d</p>
                      <p className="truncate font-label-lg text-label-lg tabular-nums text-on-surface">{tenant.appointments30d}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-xs text-label-xs text-on-surface-variant">Actividad</p>
                      <StatusDot tone={tenant.lastActivityTone} className="max-w-full">{tenant.lastActivityLabel}</StatusDot>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-xs text-label-xs text-on-surface-variant">Alta</p>
                      <p className="truncate font-label-md text-label-md tabular-nums text-on-surface">{tenant.createdLabel}</p>
                    </div>
                  </div>
                </Link>
                {tenant.slug && (
                  <a
                    href={`/${tenant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir el turnero de ${tenant.name}`}
                    className="flex w-11 shrink-0 items-center justify-center border-l border-border text-[18px] text-on-surface-variant transition-colors hover:bg-surface-muted active:bg-surface-container-low"
                  >
                    <Icon name="open_in_new" />
                  </a>
                )}
              </li>
            ))}
          </ul>

          {/* Desktop: tabla. */}
          <div className="hidden rounded-inner border border-border bg-surface lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead>Dueña</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Turnero</TableHead>
                  <TableHead>MP</TableHead>
                  <TableHead className="text-right">Turnos 30d</TableHead>
                  <TableHead className="text-right">Visitas 14d</TableHead>
                  <TableHead>Últ. actividad</TableHead>
                  <TableHead>Alta</TableHead>
                  <TableHead><span className="sr-only">Detalle</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="max-w-[16rem] py-2">
                      <Link href={`/platform/${tenant.id}`} className="block truncate font-label-lg text-label-lg text-on-surface hover:text-primary">
                        {tenant.name}
                      </Link>
                      {tenant.slug && (
                        <a
                          href={`/${tenant.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 font-body-sm text-body-sm text-on-surface-variant hover:text-primary"
                        >
                          <span className="truncate">/{tenant.slug}</span>
                          <Icon name="open_in_new" className="text-[12px]" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[14rem]">
                      <span className="block truncate font-body-sm text-body-sm text-on-surface-variant" title={tenant.ownerEmail ?? undefined}>
                        {tenant.ownerEmail ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-body-sm text-body-sm">{tenant.plan}</TableCell>
                    <TableCell>
                      <StatusDot tone={tenantStatusTone(tenant.status)}>{TENANT_STATUS_LABEL[tenant.status]}</StatusDot>
                    </TableCell>
                    <TableCell><OnOff on={tenant.bookingEnabled} onLabel="Prendido" offLabel="Apagado" /></TableCell>
                    <TableCell><OnOff on={tenant.mpConnected} onLabel="Conectado" offLabel="No" /></TableCell>
                    <TableCell className="text-right font-label-lg text-label-lg tabular-nums">{tenant.appointments30d}</TableCell>
                    <TableCell className="text-right font-body-sm text-body-sm tabular-nums">
                      {tenant.views14d}
                      <span className="block font-label-sm text-label-sm text-on-surface-variant">{tenant.conversion14d}% conv.</span>
                    </TableCell>
                    <TableCell><StatusDot tone={tenant.lastActivityTone}>{tenant.lastActivityLabel}</StatusDot></TableCell>
                    <TableCell className="whitespace-nowrap font-body-sm text-body-sm tabular-nums text-on-surface-variant">{tenant.createdLabel}</TableCell>
                    <TableCell className="p-1 text-right">
                      <Link
                        href={`/platform/${tenant.id}`}
                        aria-label={`Ver detalle de ${tenant.name}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[18px] text-on-surface-variant hover:bg-surface-muted"
                      >
                        <Icon name="chevron_right" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
