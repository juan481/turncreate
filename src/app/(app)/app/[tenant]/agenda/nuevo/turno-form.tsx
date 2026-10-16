"use client";

import { useMemo, useTransition, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { addDaysISO, longDayLabel, shortWeekdayLabel, todayISO } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ClientField } from "./client-field";
import { SlotsAndDeposit } from "./slots-and-deposit";

type StaffOption = { id: string; displayName: string; photoUrl: string | null };
type ServiceOption = { id: string; name: string; price: number };
type ClientOption = { id: string; full_name: string };
type Slot = { startsAtISO: string; label: string };

/**
 * Orquesta la selección de cliente/servicio/profesional/día y mantiene
 * la URL (?serviceId=&staffId=&date=) en sincro con lo elegido -- eso es
 * lo que hace que los horarios SIEMPRE se recalculen en el servidor para
 * la combinación actual. Antes esto era un <form method="GET"> que solo
 * recalculaba al apretar "Ver horarios disponibles": si el usuario
 * cambiaba la fecha/servicio/profesional DESPUÉS de ver los horarios, los
 * botones de horario seguían mandando el startsAt VIEJO -- tocar un
 * horario sin volver a buscar creaba el turno para el día/datos
 * anteriores (el mismo síntoma que el bug de zona horaria ya arreglado
 * en availability.ts, pero por otro camino). Ahora cada cambio relevante
 * dispara un router.replace inmediato (sin agregar entradas al historial)
 * y, mientras esa navegación está en vuelo, se oculta la lista de
 * horarios vieja en vez de dejarla tocable con datos stale.
 */
export function TurnoForm({
  tenantSlug,
  timezone,
  staffList,
  servicesList,
  clientsList,
  soloStaffId,
  initialStaffId,
  initialServiceId,
  initialClientId,
  initialDateISO,
  maxBookingDays,
  slots,
  suggestedDeposit,
  rescheduleFrom,
  keepDeposit,
}: {
  tenantSlug: string;
  timezone: string;
  staffList: StaffOption[];
  servicesList: ServiceOption[];
  clientsList: ClientOption[];
  soloStaffId?: string;
  initialStaffId?: string;
  initialServiceId?: string;
  initialClientId?: string;
  initialDateISO: string;
  maxBookingDays: number;
  slots: Slot[];
  suggestedDeposit: number;
  rescheduleFrom?: string;
  keepDeposit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [serviceId, setServiceId] = useState(initialServiceId ?? "");
  const [staffId, setStaffId] = useState(initialStaffId ?? soloStaffId ?? "");
  const [dateISO, setDateISO] = useState(initialDateISO);

  function navigate(overrides: Partial<{ staffId: string; serviceId: string; dateISO: string }>) {
    const nextStaffId = overrides.staffId ?? staffId;
    const nextServiceId = overrides.serviceId ?? serviceId;
    const nextDateISO = overrides.dateISO ?? dateISO;
    const params = new URLSearchParams();
    params.set("date", nextDateISO);
    if (nextServiceId) params.set("serviceId", nextServiceId);
    if (nextStaffId) params.set("staffId", nextStaffId);
    if (clientId) params.set("clientId", clientId);
    if (rescheduleFrom) {
      params.set("rescheduleFrom", rescheduleFrom);
      params.set("keepDeposit", keepDeposit ? "true" : "false");
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3">
      <ClientField tenantSlug={tenantSlug} clients={clientsList} value={clientId} onChange={setClientId} />

      <ServicePicker
        services={servicesList}
        value={serviceId}
        onChange={(id) => {
          setServiceId(id);
          navigate({ serviceId: id });
        }}
      />

      {!soloStaffId && (
        <StaffPicker
          staff={staffList}
          value={staffId}
          onChange={(id) => {
            setStaffId(id);
            navigate({ staffId: id });
          }}
        />
      )}

      <DayStrip
        timezone={timezone}
        dateISO={dateISO}
        maxBookingDays={maxBookingDays}
        onChange={(iso) => {
          setDateISO(iso);
          navigate({ dateISO: iso });
        }}
      />

      {clientId && serviceId && staffId ? (
        isPending ? (
          <Card hoverLift={false} className="flex items-center justify-center gap-2 p-lg text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            Buscando horarios…
          </Card>
        ) : (
          <SlotsAndDeposit
            tenantSlug={tenantSlug}
            staffId={staffId}
            clientId={clientId}
            serviceId={serviceId}
            dateISO={dateISO}
            slots={slots}
            suggestedDeposit={suggestedDeposit}
            rescheduleFrom={rescheduleFrom}
            keepDeposit={keepDeposit}
          />
        )
      ) : null}
    </div>
  );
}

function ServicePicker({
  services,
  value,
  onChange,
}: {
  services: ServiceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-label-md text-label-md text-on-surface-variant">Servicio</label>
      <div className="flex flex-col gap-2">
        {services.map((s) => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-inner border px-4 py-2 text-left transition-all duration-200 ease-out active:scale-[0.98]",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-muted hover:bg-surface-container",
              )}
            >
              <span className="min-w-0 truncate font-label-md text-label-md text-on-surface">{s.name}</span>
              <span className="shrink-0 font-label-md text-label-md tabular-nums text-on-surface-variant">
                ${s.price.toLocaleString("es-AR")}
              </span>
            </button>
          );
        })}
        {services.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay servicios activos.</p>
        )}
      </div>
    </div>
  );
}

function StaffPicker({
  staff,
  value,
  onChange,
}: {
  staff: StaffOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options: { id: string; displayName: string; photoUrl: string | null }[] = [
    { id: "any", displayName: "Cualquiera", photoUrl: null },
    ...staff,
  ];

  return (
    <div className="space-y-1.5">
      <label className="font-label-md text-label-md text-on-surface-variant">Profesional</label>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {options.map((s) => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              {s.id === "any" ? (
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-surface-muted text-on-surface-variant",
                  )}
                >
                  <Icon name="groups" className="text-[22px]" />
                </span>
              ) : (
                <span className={cn("rounded-full border-2 transition-colors", active ? "border-primary" : "border-transparent")}>
                  <Avatar name={s.displayName} src={s.photoUrl} size="lg" />
                </span>
              )}
              <span
                className={cn(
                  "max-w-[4.5rem] truncate font-label-xs text-label-xs",
                  active ? "font-semibold text-on-surface" : "text-on-surface-variant",
                )}
              >
                {s.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayStrip({
  timezone,
  dateISO,
  maxBookingDays,
  onChange,
}: {
  timezone: string;
  dateISO: string;
  maxBookingDays: number;
  onChange: (iso: string) => void;
}) {
  const days = useMemo(() => {
    const start = todayISO(timezone);
    return Array.from({ length: Math.min(14, Math.max(1, maxBookingDays + 1)) }, (_, i) => addDaysISO(start, i));
  }, [maxBookingDays, timezone]);
  const firstDateISO = todayISO(timezone);
  const lastDateISO = addDaysISO(firstDateISO, Math.max(0, maxBookingDays));

  return (
    <div className="space-y-1.5">
      <label className="font-label-md text-label-md text-on-surface-variant">Día</label>
      <p className="font-headline-sm text-headline-sm text-on-surface">{longDayLabel(dateISO)}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((iso) => {
          const active = iso === dateISO;
          const day = Number(iso.slice(8, 10));
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              className={cn(
                "flex h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-inner border font-label-sm text-label-sm transition-all duration-200 ease-out active:scale-95",
                active
                  ? "border-primary bg-primary text-on-primary shadow-card-hover"
                  : "border-border bg-surface-muted text-on-surface-variant hover:bg-surface-container",
              )}
            >
              <span className="uppercase opacity-80">{shortWeekdayLabel(iso)}</span>
              <span className="font-headline-sm text-headline-sm tabular-nums">{day}</span>
            </button>
          );
        })}
      </div>
      <label className="block space-y-1">
        <span className="font-label-sm text-label-sm text-on-surface-variant">Otra fecha</span>
        <input type="date" min={firstDateISO} max={lastDateISO} value={dateISO} onChange={(event) => { if (event.target.value) onChange(event.target.value); }} className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
      </label>
    </div>
  );
}
