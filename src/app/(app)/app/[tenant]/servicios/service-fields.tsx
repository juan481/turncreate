"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import { createServiceCategory } from "./actions";

export type ServiceFieldValues = {
  name: string;
  price: number | "";
  durationMin: number;
  categoryId: string | null;
  description: string;
  public: boolean;
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

const chipClass = (active: boolean) =>
  cn(
    "inline-flex min-h-10 items-center gap-1 rounded-pill border px-3.5 font-label-md text-label-md transition-colors",
    active
      ? "border-primary bg-primary text-on-primary"
      : "border-border bg-surface text-on-surface hover:bg-surface-container-low",
  );

/**
 * Campos de un servicio, compartidos por el alta y la edición. Los
 * valores viajan en el form por `name` (más inputs hidden para lo que se
 * elige con chips), así cada pantalla solo decide qué hacer al guardar.
 */
export function ServiceFields({
  tenantSlug,
  categories: initialCategories,
  defaults,
}: {
  tenantSlug: string;
  categories: ServiceCategoryRecord[];
  defaults: ServiceFieldValues;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [categoryId, setCategoryId] = useState<string | null>(defaults.categoryId);
  const [durationMin, setDurationMin] = useState<number | "">(defaults.durationMin);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryPending, startCategoryTransition] = useTransition();

  function createCategory() {
    setCategoryError(null);
    const name = newCategoryName.trim();
    startCategoryTransition(async () => {
      const result = await createServiceCategory(tenantSlug, name);
      if (result.error || !result.id) {
        setCategoryError(result.error ?? "No se pudo crear la categoría");
        return;
      }
      setCategories((previous) => [...previous, { id: result.id!, name, active: true, sort: Date.now() }]);
      setCategoryId(result.id);
      setNewCategoryName("");
      setCreatingCategory(false);
    });
  }

  return (
    <div className="space-y-md">
      <input type="hidden" name="categoryId" value={categoryId ?? ""} />

      <div className="space-y-1.5">
        <label htmlFor="service-name" className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
        <Input id="service-name" name="name" defaultValue={defaults.name} placeholder="Ej: Kapping en gel" maxLength={100} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="service-price" className="font-label-md text-label-md text-on-surface-variant">Precio</label>
          <Input id="service-price" name="price" type="number" min="0.01" step="0.01" inputMode="decimal" defaultValue={defaults.price} placeholder="$ 0" required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="service-duration" className="font-label-md text-label-md text-on-surface-variant">Duración (min)</label>
          <Input
            id="service-duration"
            name="durationMin"
            type="number"
            min="5"
            max="720"
            step="5"
            inputMode="numeric"
            value={durationMin}
            onChange={(event) => setDurationMin(event.target.value === "" ? "" : Number(event.target.value))}
            required
          />
        </div>
      </div>
      <div className="-mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Duraciones rápidas">
        {DURATION_PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setDurationMin(minutes)}
            className={cn(
              "min-h-9 rounded-pill px-3 font-label-sm text-label-sm tabular-nums transition-colors",
              durationMin === minutes ? "bg-secondary-soft text-secondary" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface",
            )}
          >
            {minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60}` : ""}`}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="font-label-md text-label-md text-on-surface-variant">
          Categoría <span className="font-body-sm text-body-sm">(opcional)</span>
        </p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoría">
          <button type="button" role="radio" aria-checked={categoryId === null} onClick={() => setCategoryId(null)} className={chipClass(categoryId === null)}>
            Sin categoría
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
              className={chipClass(categoryId === category.id)}
            >
              {category.name}
            </button>
          ))}
          {!creatingCategory && (
            <button
              type="button"
              onClick={() => setCreatingCategory(true)}
              className="inline-flex min-h-10 items-center gap-1 rounded-pill border border-dashed border-secondary/50 px-3.5 font-label-md text-label-md text-secondary hover:bg-secondary-soft"
            >
              <Icon name="add" className="text-[16px]" />
              Nueva categoría
            </button>
          )}
        </div>
        {creatingCategory && (
          <div className="flex flex-col gap-2 rounded-inner bg-surface-container-low p-3 sm:flex-row">
            <label className="sr-only" htmlFor="inline-new-category">Nombre de la nueva categoría</label>
            <Input
              id="inline-new-category"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Ej: Manos, Pies, Nail art"
              maxLength={60}
              autoFocus
              disabled={categoryPending}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (newCategoryName.trim().length >= 2) createCategory();
                }
              }}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" className="min-h-11 flex-1 sm:flex-none" disabled={categoryPending || newCategoryName.trim().length < 2} onClick={createCategory}>
                {categoryPending ? "Creando…" : "Crear"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11 flex-1 sm:flex-none"
                onClick={() => {
                  setCreatingCategory(false);
                  setNewCategoryName("");
                  setCategoryError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {categoryError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{categoryError}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="service-description" className="font-label-md text-label-md text-on-surface-variant">
          Descripción para la clienta <span className="font-body-sm text-body-sm">(opcional)</span>
        </label>
        <textarea
          id="service-description"
          name="description"
          rows={3}
          maxLength={600}
          defaultValue={defaults.description}
          placeholder="Contá brevemente qué incluye y para quién está recomendado."
          className="w-full resize-y rounded-inner border-0 bg-surface-muted px-4 py-3 font-body-lg text-body-lg text-on-surface outline-none ring-2 ring-transparent transition-all placeholder:text-on-surface-variant focus:bg-surface focus:ring-secondary"
        />
      </div>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-inner bg-surface-container-low px-3 py-2.5">
        <input name="public" type="checkbox" defaultChecked={defaults.public} className="h-5 w-5 shrink-0 accent-secondary" />
        <span className="min-w-0">
          <span className="block font-label-md text-label-md text-on-surface">Visible en el turnero</span>
          <span className="block font-body-sm text-body-sm text-on-surface-variant">Tu clienta lo puede reservar online.</span>
        </span>
      </label>
    </div>
  );
}
