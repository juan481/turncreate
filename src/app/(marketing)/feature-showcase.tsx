"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

type TabKey = "turnero" | "clientes" | "caja" | "reportes" | "sena";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "turnero", label: "Turnero público", icon: "link" },
  { key: "clientes", label: "Clientes", icon: "group" },
  { key: "caja", label: "Caja", icon: "point_of_sale" },
  { key: "reportes", label: "Reportes", icon: "monitoring" },
  { key: "sena", label: "Seña", icon: "payments" },
];

function FrameChrome({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-card border border-border bg-surface-container-lowest shadow-card-hover">
      <div className="flex items-center gap-2 border-b border-border bg-surface-container-low px-lg py-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-status-alert-dot" />
        <span className="h-2.5 w-2.5 rounded-full bg-status-draft-dot" />
        <span className="h-2.5 w-2.5 rounded-full bg-status-confirmed-dot" />
        <span className="ml-2 font-label-sm text-label-sm text-on-surface-variant">{title}</span>
      </div>
      <div className="p-lg md:p-xl">{children}</div>
    </div>
  );
}

function TurneroMockup() {
  return (
    <FrameChrome title="turncreate.com.ar/tu-salon">
      <div className="mx-auto max-w-[22rem] space-y-md">
        <StatusPill status="pending">Paso 1 de 4 · Servicio</StatusPill>
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Elegí tu tratamiento</h3>
        <div className="space-y-2">
          {[
            { name: "Limpieza Facial Profunda", dur: "45 min", price: "$24.000" },
            { name: "Corte Clásico", dur: "30 min", price: "$8.500" },
          ].map((s) => (
            <div key={s.name} className="flex items-center justify-between rounded-inner bg-surface-container-low p-3">
              <div>
                <p className="font-label-md text-label-md text-on-surface">{s.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{s.dur}</p>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface">{s.price}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2 rounded-inner bg-status-confirmed-bg p-md text-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-status-confirmed">
            <Icon name="check" className="text-[22px]" />
          </div>
          <p className="font-label-md text-label-md text-status-confirmed">¡Turno confirmado!</p>
        </div>
      </div>
    </FrameChrome>
  );
}

function ClientesMockup() {
  const clientes = [
    { name: "Camila Morales", detail: "+54 9 11 4455-8822", tag: null },
    { name: "Julieta Navarro", detail: "Cliente frecuente · 6 visitas", tag: "confirmed" as const },
    { name: "Federico Aguirre", detail: "2 ausencias", tag: "alert" as const },
  ];
  return (
    <FrameChrome title="app.turncreate.com.ar/clientes">
      <div className="space-y-3">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant" />
          <div className="h-10 rounded-pill bg-surface-container-low pl-10 pr-4 leading-10 font-body-sm text-body-sm text-on-surface-variant">
            Buscar por nombre, teléfono o email…
          </div>
        </div>
        <div className="divide-y divide-border rounded-inner border border-border">
          {clientes.map((c) => (
            <div key={c.name} className="flex items-center gap-3 p-3">
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-label-md text-label-md text-on-surface">{c.name}</p>
                <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{c.detail}</p>
              </div>
              {c.tag === "alert" && <StatusPill status="alert">2 ausencias</StatusPill>}
              <Icon name="chevron_right" className="text-[16px] text-on-surface-variant" />
            </div>
          ))}
        </div>
      </div>
    </FrameChrome>
  );
}

function CajaMockup() {
  return (
    <FrameChrome title="app.turncreate.com.ar/caja">
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Apertura", value: "$5.000", color: "text-on-surface" },
            { label: "Entradas", value: "+$32.000", color: "text-status-confirmed" },
            { label: "Salidas", value: "-$2.000", color: "text-status-alert" },
            { label: "Esperado", value: "$35.000", color: "text-secondary" },
          ].map((k) => (
            <div key={k.label} className="rounded-inner bg-surface-container-low p-2 text-center">
              <p className="font-label-sm text-label-sm text-on-surface-variant">{k.label}</p>
              <p className={cn("font-label-md text-label-md", k.color)}>{k.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-inner bg-surface-container-low p-3">
          <div className="flex items-center gap-2">
            <Avatar name="Camila Morales" size="sm" />
            <div>
              <p className="font-label-md text-label-md text-on-surface">10:00 · Camila Morales</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Limpieza Facial</p>
            </div>
          </div>
          <span className="rounded-pill bg-primary px-3 py-1.5 font-label-sm text-label-sm text-on-primary">Cobrar</span>
        </div>
      </div>
    </FrameChrome>
  );
}

function ReportesMockup() {
  const bars = [40, 55, 48, 70, 60, 90];
  return (
    <FrameChrome title="app.turncreate.com.ar/reportes">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Turnos realizados", value: "128" },
            { label: "Clientes nuevos", value: "24" },
            { label: "Ingresos del mes", value: "$980k" },
          ].map((k) => (
            <div key={k.label} className="rounded-inner bg-surface-container-low p-2">
              <p className="font-label-sm text-label-sm text-on-surface-variant">{k.label}</p>
              <p className="font-label-lg text-label-lg text-on-surface">{k.value}</p>
            </div>
          ))}
        </div>
        <div className="flex h-20 items-end gap-2 rounded-inner bg-surface-container-low p-3">
          {bars.map((h, i) => (
            <div
              key={i}
              className={cn("flex-1 rounded-t-sm", i === bars.length - 1 ? "bg-primary" : "bg-secondary-soft")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </FrameChrome>
  );
}

function SenaMockup() {
  const [selected, setSelected] = useState<"none" | "percent" | "fixed">("percent");
  const opciones = [
    { key: "none" as const, label: "Sin seña" },
    { key: "percent" as const, label: "% del servicio" },
    { key: "fixed" as const, label: "Monto fijo" },
  ];
  return (
    <FrameChrome title="app.turncreate.com.ar/configuracion">
      <div className="space-y-md">
        <div>
          <p className="font-label-md text-label-md text-on-surface">Política de seña</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Elegís vos cómo pedirle la seña al cliente. Se puede cambiar cuando quieras.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-pill bg-surface-container p-1">
          {opciones.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setSelected(o.key)}
              className={cn(
                "rounded-pill px-3 py-1.5 font-label-sm text-label-sm transition-all",
                selected === o.key ? "bg-primary text-on-primary" : "text-on-surface-variant",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {selected !== "none" && (
          <div className="flex items-center gap-2 rounded-inner bg-surface-container-low p-3">
            <span className="font-label-md text-label-md text-on-surface">
              {selected === "percent" ? "50" : "$ 5.000"}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {selected === "percent" ? "% del total del turno" : "por turno reservado"}
            </span>
          </div>
        )}
        <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-status-confirmed">
          <Icon name="check_circle" className="text-[16px]" />
          Se acredita directo en tu cuenta de Mercado Pago
        </p>
      </div>
    </FrameChrome>
  );
}

const MOCKUPS: Record<TabKey, React.ComponentType> = {
  turnero: TurneroMockup,
  clientes: ClientesMockup,
  caja: CajaMockup,
  reportes: ReportesMockup,
  sena: SenaMockup,
};

export function FeatureShowcase() {
  const [active, setActive] = useState<TabKey>("turnero");
  const ActiveMockup = MOCKUPS[active];

  return (
    <div>
      <div className="mb-lg flex flex-wrap justify-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-pill border px-4 py-2 font-label-md text-label-md transition-all duration-200",
              active === tab.key
                ? "border-primary bg-primary text-on-primary shadow-card"
                : "border-border bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant",
            )}
          >
            <Icon name={tab.icon} className="text-[16px]" />
            {tab.label}
          </button>
        ))}
      </div>
      <div key={active} className="animate-fade-up">
        <ActiveMockup />
      </div>
    </div>
  );
}
