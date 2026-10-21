"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import {
  BRAND_COLOR_IDS,
  BRAND_PALETTES,
  brandThemeStyle,
  type BrandColorId,
} from "@/lib/brand-theme";
import { cn } from "@/lib/utils";

const BOOKING_STEPS = [
  { short: "Servicio", title: "Elegí un servicio", icon: "content_cut" },
  { short: "Fecha", title: "Elegí fecha y horario", icon: "calendar_month" },
  { short: "Datos", title: "Contanos tus datos", icon: "person" },
  { short: "Pago", title: "Confirmá la seña", icon: "payments" },
  { short: "Listo", title: "Turno confirmado", icon: "check_circle" },
] as const;

const SERVICES = [
  { name: "Corte de pelo", time: "45 min", price: "$18.000" },
  { name: "Corte + barba", time: "60 min", price: "$26.000" },
  { name: "Limpieza facial", time: "60 min", price: "$30.000" },
] as const;

function MiniProgress({ active }: { active: number }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" aria-label={`Paso ${active + 1} de 5`}>
      {BOOKING_STEPS.map((step, index) => (
        <span
          key={step.short}
          className={cn("h-1 rounded-pill transition-colors duration-300", index <= active ? "bg-primary" : "bg-surface-container-high")}
        />
      ))}
    </div>
  );
}

function BookingPanel({ active, color = "iris" }: { active: number; color?: BrandColorId }) {
  return (
    <div
      className="marketing-panel-enter min-h-[360px] rounded-[1.4rem] bg-surface p-4 text-left shadow-card"
      style={brandThemeStyle(color)}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-on-primary shadow-brand">
            <Icon name="auto_awesome" className="text-[14px]" />
          </span>
          <span className="text-[12px] font-bold tracking-tight text-on-surface">Studio Lumen</span>
        </div>
        <span className="text-[10px] font-semibold text-on-surface-variant">Paso {active + 1} de 5</span>
      </div>
      <MiniProgress active={active} />

      <div key={active} className="marketing-panel-enter mt-5">
        {active === 0 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">Reserva online</p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-on-surface">Elegí un servicio</h3>
            <div className="mt-4 space-y-2">
              {SERVICES.map((service, index) => (
                <button
                  key={service.name}
                  type="button"
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                    index === 0
                      ? "border-primary bg-secondary-soft shadow-sm"
                      : "border-border bg-surface hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card",
                  )}
                >
                  <span className={cn("flex size-5 items-center justify-center rounded-full border", index === 0 ? "border-primary bg-primary text-on-primary" : "border-outline-variant")}>
                    {index === 0 && <Icon name="check" className="text-[12px]" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-on-surface">{service.name}</span>
                    <span className="block text-[10px] text-on-surface-variant">{service.time}</span>
                  </span>
                  <span className="text-[11px] font-semibold text-on-surface">{service.price}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {active === 1 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">Disponibilidad real</p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-on-surface">Octubre 2026</h3>
            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px]">
              {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`} className="py-1 text-on-surface-variant">{day}</span>)}
              {[19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1].map((day) => (
                <span key={day} className={cn("flex aspect-square items-center justify-center rounded-full", day === 22 ? "bg-primary font-bold text-on-primary shadow-brand" : day === 25 ? "text-outline-variant line-through" : "text-on-surface")}>{day}</span>
              ))}
            </div>
            <p className="mt-4 text-[11px] font-semibold text-on-surface">Horarios disponibles</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "14:30", "15:00", "15:30"].map((time) => (
                <button key={time} type="button" className={cn("min-h-9 rounded-pill text-[11px] font-semibold transition-all", time === "11:30" ? "bg-primary text-on-primary shadow-brand" : "bg-surface-container-low text-on-surface hover:bg-secondary-soft hover:text-primary")}>{time}</button>
              ))}
            </div>
          </>
        )}

        {active === 2 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">Tu información</p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-on-surface">Contanos tus datos</h3>
            <div className="mt-4 space-y-3">
              {[
                ["Nombre completo", "Camila Ferraro"],
                ["WhatsApp", "11 2345-6789"],
                ["Email", "camila@ejemplo.com"],
              ].map(([label, value]) => (
                <label key={label} className="block text-[10px] font-semibold text-on-surface-variant">
                  {label}
                  <span className="mt-1 flex min-h-10 items-center rounded-xl border border-border bg-surface-container-lowest px-3 text-[11px] font-medium text-on-surface">{value}</span>
                </label>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-secondary-soft p-3 text-[10px] leading-relaxed text-on-surface-variant">
              <Icon name="shield_person" className="mt-0.5 text-[14px] text-primary" />
              Tus datos solo se usan para gestionar y recordarte el turno.
            </p>
          </>
        )}

        {active === 3 && (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">Seña protegida</p>
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.03em] text-on-surface">Pago y confirmación</h3>
            <div className="mt-4 rounded-xl bg-surface-container-low p-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-on-surface-variant">Corte de pelo · jue 22, 11:30</span>
                <span className="font-semibold text-on-surface">$18.000</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[12px] font-semibold text-on-surface">
                <span>Seña</span><span>$6.000</span>
              </div>
            </div>
            <button type="button" className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary bg-secondary-soft p-3 text-left">
              <MercadoPagoLogo className="text-[22px]" />
              <span className="flex-1 text-[11px] font-semibold text-on-surface">Pagar con Mercado Pago</span>
              <Icon name="chevron_right" className="text-[16px] text-primary" />
            </button>
            <p className="mt-3 rounded-xl bg-surface-container-low p-3 text-[10px] leading-relaxed text-on-surface-variant">
              La seña es reembolsable cancelando hasta 24 horas antes del turno. Recibirás un enlace para reprogramar o cancelar.
            </p>
          </>
        )}

        {active === 4 && (
          <div className="flex min-h-[270px] flex-col items-center justify-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-status-confirmed-bg text-status-confirmed shadow-card">
              <Icon name="check_circle" className="text-[32px]" />
            </span>
            <h3 className="mt-5 text-[22px] font-semibold tracking-[-0.03em] text-on-surface">¡Turno confirmado!</h3>
            <p className="mt-2 max-w-[230px] text-[11px] leading-relaxed text-on-surface-variant">Te enviamos la confirmación y tu enlace privado para administrar la reserva.</p>
            <span className="mt-5 rounded-pill bg-secondary-soft px-4 py-2 text-[10px] font-semibold text-primary">Jueves 22 · 11:30</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BookingJourney() {
  const [active, setActive] = useState(0);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
      <div className="min-w-0">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {BOOKING_STEPS.map((step, index) => (
            <button
              key={step.title}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              className={cn(
                "group flex min-h-16 items-center gap-4 rounded-[1.15rem] border px-4 text-left transition-all duration-300",
                active === index
                  ? "translate-x-1 border-primary/20 bg-surface shadow-card-hover"
                  : "border-transparent hover:translate-x-1 hover:border-border hover:bg-surface/70",
              )}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300", active === index ? "bg-primary text-on-primary shadow-brand" : "bg-surface-container text-on-surface-variant group-hover:bg-secondary-soft group-hover:text-primary")}>{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-on-surface">{step.title}</span>
                <span className="mt-0.5 block text-[12px] text-on-surface-variant">{index === 0 ? "Servicio y profesional" : index === 1 ? "Dos meses y grilla amplia" : index === 2 ? "Solo lo indispensable" : index === 3 ? "Mercado Pago o transferencia" : "Confirmación y link de gestión"}</span>
              </span>
              <Icon name={step.icon} className={cn("text-[18px] transition-colors", active === index ? "text-primary" : "text-outline-variant group-hover:text-primary")} />
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[560px]">
        <div aria-hidden="true" className="absolute inset-8 -z-10 rounded-full bg-primary-glow/35 blur-3xl" />
        <div className="marketing-browser-frame rounded-[2rem] border border-white/80 bg-white/55 p-3 shadow-[0_32px_90px_-34px_rgba(65,55,160,.34)] backdrop-blur-xl sm:p-5">
          <div className="mb-3 flex items-center gap-1.5 px-2">
            <span className="size-2 rounded-full bg-[#ff8d8d]" /><span className="size-2 rounded-full bg-[#ffd36d]" /><span className="size-2 rounded-full bg-[#7bd88f]" />
            <span className="ml-3 h-5 flex-1 rounded-pill bg-surface-container-low" />
          </div>
          <BookingPanel active={active} />
          <div className="mt-3 flex items-center gap-2 px-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => setActive((current) => Math.max(0, current - 1))} disabled={active === 0} className="flex-1">Volver</Button>
            <Button type="button" size="sm" onClick={() => setActive((current) => Math.min(BOOKING_STEPS.length - 1, current + 1))} disabled={active === BOOKING_STEPS.length - 1} className="group flex-1">
              Continuar <Icon name="arrow_forward" className="text-[14px] transition-transform group-hover:translate-x-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPhone({ color, selected = false }: { color: BrandColorId; selected?: boolean }) {
  const palette = BRAND_PALETTES[color];
  return (
    <button
      type="button"
      aria-label={`Vista previa ${palette.label}`}
      className={cn("group min-w-[158px] flex-1 rounded-[1.65rem] border bg-white p-2.5 text-left shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover", selected ? "border-primary ring-2 ring-primary/15" : "border-border")}
      style={brandThemeStyle(color)}
    >
      <div className="rounded-[1.2rem] bg-surface p-3">
        <div className="flex items-center gap-1.5"><span className="size-4 rounded-[5px] bg-primary" /><span className="text-[8px] font-bold text-on-surface">Tu marca</span></div>
        <div className="mt-3 grid grid-cols-4 gap-1"><span className="h-1 rounded-pill bg-primary" /><span className="h-1 rounded-pill bg-primary/25" /><span className="h-1 rounded-pill bg-primary/25" /><span className="h-1 rounded-pill bg-primary/25" /></div>
        <p className="mt-4 text-[11px] font-semibold text-on-surface">Elegí un servicio</p>
        <div className="mt-2 space-y-1.5">
          {["Corte de pelo", "Corte + barba", "Limpieza facial"].map((service, index) => <span key={service} className={cn("flex h-8 items-center rounded-lg border px-2 text-[7px] font-semibold", index === 0 ? "border-primary bg-secondary-soft text-primary" : "border-border text-on-surface")}>{service}</span>)}
        </div>
        <span className="mt-3 flex h-8 items-center justify-center rounded-pill bg-primary text-[8px] font-bold text-on-primary shadow-brand">Continuar →</span>
      </div>
    </button>
  );
}

export function BrandColorShowcase() {
  const [color, setColor] = useState<BrandColorId>("iris");

  return (
    <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
      <div className="min-w-0">
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color de ejemplo">
          {BRAND_COLOR_IDS.map((id) => {
            const palette = BRAND_PALETTES[id];
            const isSelected = color === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setColor(id)}
                className={cn("group flex min-h-12 items-center gap-2 rounded-pill border px-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-card", isSelected ? "border-primary bg-surface shadow-card" : "border-border bg-surface/50")}
                style={isSelected ? brandThemeStyle(id) : undefined}
              >
                <span className="size-6 rounded-full ring-4 ring-white shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: palette.primary }} />
                <span className="text-[12px] font-semibold text-on-surface">{palette.label}</span>
                {isSelected && <Icon name="check" className="text-[14px] text-primary" />}
              </button>
            );
          })}
        </div>
        <p className="mt-5 max-w-[28rem] text-[14px] leading-7 text-on-surface-variant">
          Elegís una paleta cuidada y accesible. El turnero, sus botones, estados activos y focos adoptan tu color sin perder legibilidad.
        </p>
      </div>

      <div className="min-w-0 overflow-x-auto pb-5 pt-3 [scrollbar-width:none]">
        <div className="flex min-w-max gap-4 px-1">
          {BRAND_COLOR_IDS.map((id) => (
            <div key={id} onClick={() => setColor(id)}><ColorPhone color={id} selected={color === id} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
