"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
  BRAND_COLOR_IDS,
  BRAND_PALETTES,
  brandColorHex,
  brandThemeStyle,
  contrastWithWhite,
  isAllowedBrandColor,
  normalizeBrandColor,
  type BrandColorValue,
} from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { updateBrandColor, type ConfigActionState } from "./actions";

const initialState: ConfigActionState = { error: null };

export function BrandColorForm({ tenantSlug, brandColor }: { tenantSlug: string; brandColor?: BrandColorValue | null }) {
  const initial = normalizeBrandColor(brandColor);
  const initialHex = brandColorHex(initial);
  const [selectedHex, setSelectedHex] = useState(initialHex);
  const validHex = /^#[0-9a-f]{6}$/i.test(selectedHex);
  const valid = validHex && isAllowedBrandColor(selectedHex);
  const previewHex = validHex ? selectedHex : initialHex;
  const contrast = useMemo(() => validHex ? contrastWithWhite(selectedHex) : 0, [selectedHex, validHex]);
  const toast = useToast();
  const [state, formAction, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateBrandColor(tenantSlug, prev, formData);
    if (result.success) toast.show("Color de marca guardado");
    return result;
  }, initialState);

  const choose = (value: string) => setSelectedHex(value.toLowerCase());

  return (
    <form action={formAction} className="space-y-lg">
      <input type="hidden" name="brandColor" value={selectedHex} />
      <div className="grid gap-md sm:grid-cols-[11rem_1fr] sm:items-start">
        <label className="group relative grid min-h-36 cursor-pointer place-items-center overflow-hidden rounded-card border border-border bg-surface-container-low p-md shadow-card transition-transform hover:-translate-y-0.5">
          <input
            type="color"
            value={previewHex}
            onChange={(event) => choose(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Elegir cualquier color de marca"
          />
          <span className="grid size-20 place-items-center rounded-full border-[6px] border-white shadow-card-hover" style={{ backgroundColor: selectedHex }}>
            <Icon name="palette" className="text-[28px] text-white" />
          </span>
          <span className="font-label-md text-label-md text-on-surface">Abrir selector</span>
        </label>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="brand-color-hex" className="font-label-md text-label-md text-on-surface-variant">Color hexadecimal</label>
            <Input
              id="brand-color-hex"
              value={selectedHex}
              onChange={(event) => choose(event.target.value)}
              maxLength={7}
              spellCheck={false}
              className="font-mono uppercase sm:max-w-[14rem]"
              aria-invalid={!valid}
            />
          </div>
          <p className={cn("flex items-start gap-2 rounded-inner px-3 py-2.5 font-body-sm text-body-sm", valid ? "bg-status-confirmed-bg text-status-confirmed" : "bg-status-alert-bg text-status-alert")}>
            <Icon name={valid ? "check_circle" : "palette"} className="mt-0.5 shrink-0 text-[16px]" />
            <span>{valid ? `Contraste accesible con texto blanco (${contrast.toFixed(1)}:1).` : "Este color es demasiado claro. Elegí uno más oscuro para que los botones se lean bien."}</span>
          </p>
          <div>
            <p className="mb-2 font-label-sm text-label-sm text-on-surface-variant">Colores sugeridos</p>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLOR_IDS.map((id) => {
                const palette = BRAND_PALETTES[id];
                const active = selectedHex === palette.primary;
                return (
                  <button key={id} type="button" aria-label={palette.label} aria-pressed={active} onClick={() => choose(palette.primary)} className={cn("size-11 rounded-full border-4 border-white shadow-sm ring-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary", active ? "ring-on-surface" : "ring-border")} style={{ backgroundColor: palette.primary }} />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={brandThemeStyle(previewHex)} className="overflow-hidden rounded-card border border-border bg-surface-container-low p-md sm:p-lg">
        <div className="mb-md flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Vista previa en tiempo real</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Botones, pasos, selecciones y foco usan el mismo color.</p>
          </div>
          <span className="rounded-pill bg-secondary-soft px-3 py-1 font-label-sm text-label-sm text-secondary">Paso 2 de 5</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['10:00', '10:30', '11:00'].map((time, index) => (
            <span key={time} className={cn("rounded-pill px-3 py-2 text-center font-label-md text-label-md", index === 1 ? "bg-primary text-on-primary shadow-brand" : "bg-surface text-on-surface")}>{time}</span>
          ))}
        </div>
        <div className="mt-md flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary"><Icon name="check_circle" /> Disponible</span>
          <span className="inline-flex min-h-11 items-center rounded-pill bg-primary px-5 font-label-md text-label-md text-on-primary">Continuar <Icon name="arrow_forward" /></span>
        </div>
      </div>

      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending || !valid || selectedHex === initialHex}>
        {pending ? "Guardando…" : "Guardar color"}
      </Button>
    </form>
  );
}
