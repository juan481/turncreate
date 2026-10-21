"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  BRAND_COLOR_IDS,
  BRAND_PALETTES,
  brandThemeStyle,
  normalizeBrandColor,
  type BrandColorId,
} from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { updateBrandColor, type ConfigActionState } from "./actions";

const initialState: ConfigActionState = { error: null };

export function BrandColorForm({ tenantSlug, brandColor }: { tenantSlug: string; brandColor?: BrandColorId | null }) {
  const initial = normalizeBrandColor(brandColor);
  const [selected, setSelected] = useState<BrandColorId>(initial);
  const toast = useToast();
  const [state, formAction, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateBrandColor(tenantSlug, prev, formData);
    if (result.success) toast.show("Color de marca guardado");
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-lg">
      <input type="hidden" name="brandColor" value={selected} />
      <fieldset>
        <legend className="font-label-md text-label-md text-on-surface-variant">Elegí una paleta</legend>
        <div className="mt-sm grid grid-cols-2 gap-sm sm:grid-cols-5">
          {BRAND_COLOR_IDS.map((id) => {
            const palette = BRAND_PALETTES[id];
            const active = selected === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(id)}
                className={cn(
                  "group flex min-h-20 flex-col items-center justify-center gap-2 rounded-inner border bg-surface-container-lowest p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
                  active ? "border-secondary shadow-card ring-2 ring-secondary/20" : "border-border",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-8 rounded-full shadow-sm ring-4 ring-white transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: palette.primary }}
                />
                <span className={cn("font-label-sm text-label-sm", active ? "text-on-surface" : "text-on-surface-variant")}>{palette.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div style={brandThemeStyle(selected)} className="overflow-hidden rounded-card border border-border bg-surface-container-low p-md sm:p-lg">
        <div className="mb-md flex items-center justify-between gap-3">
          <div>
            <p className="font-label-lg text-label-lg text-on-surface">Vista previa del turnero</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Botones, selecciones y foco usan tu color.</p>
          </div>
          <span className="rounded-pill bg-secondary-soft px-3 py-1 font-label-sm text-label-sm text-secondary">Paso 2 de 5</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['10:00', '10:30', '11:00'].map((time, index) => (
            <span key={time} className={cn("rounded-pill px-3 py-2 text-center font-label-md text-label-md", index === 1 ? "bg-primary text-on-primary shadow-brand" : "bg-surface text-on-surface")}>{time}</span>
          ))}
        </div>
        <div className="mt-md flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-status-confirmed"><Icon name="check_circle" /> Disponible</span>
          <span className="inline-flex min-h-11 items-center rounded-pill bg-primary px-5 font-label-md text-label-md text-on-primary">Continuar <Icon name="arrow_forward" /></span>
        </div>
      </div>

      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending || selected === initial}>
        {pending ? "Guardando…" : "Guardar color"}
      </Button>
    </form>
  );
}
