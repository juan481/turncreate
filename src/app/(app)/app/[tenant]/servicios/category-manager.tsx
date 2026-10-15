"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import {
  archiveServiceCategory,
  createServiceCategory,
  renameServiceCategory,
} from "./actions";

export function CategoryManager({
  tenantSlug,
  categories,
}: {
  tenantSlug: string;
  categories: ServiceCategoryRecord[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ error: string | null }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function beginEdit(category: ServiceCategoryRecord) {
    setEditingId(category.id);
    setEditingName(category.name);
    setError(null);
  }

  return (
    <Card hoverLift={false} className="p-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-secondary">
            <Icon name="category" className="text-[20px]" />
          </span>
          <span className="min-w-0">
            <span className="block font-headline-sm text-headline-sm text-on-surface">Categorías</span>
            <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">
              {categories.length > 0
                ? `${categories.length} para ordenar tu catálogo`
                : "Creá la primera para ordenar tus servicios"}
            </span>
          </span>
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} className="shrink-0 text-[22px] text-on-surface-variant" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Las categorías ayudan a que tus clientas encuentren rápido el servicio que buscan.
          </p>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => createServiceCategory(tenantSlug, newName), () => setNewName(""));
            }}
          >
            <label className="sr-only" htmlFor="new-service-category">Nueva categoría</label>
            <Input
              id="new-service-category"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ej: Manos, Pies, Nail art"
              maxLength={60}
              required
              disabled={pending}
            />
            <Button type="submit" disabled={pending || newName.trim().length < 2} className="w-full sm:w-auto">
              <Icon name="add" className="text-[18px]" />
              Agregar
            </Button>
          </form>

          {categories.length > 0 && (
            <div className="divide-y divide-border overflow-hidden rounded-inner border border-border">
              {categories.map((category) => (
                <div key={category.id} className="bg-surface px-3 py-2.5">
                  {editingId === category.id ? (
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => {
                        event.preventDefault();
                        run(
                          () => renameServiceCategory(tenantSlug, category.id, editingName),
                          () => setEditingId(null),
                        );
                      }}
                    >
                      <label className="sr-only" htmlFor={`category-${category.id}`}>Nombre de la categoría</label>
                      <Input
                        id={`category-${category.id}`}
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        maxLength={60}
                        autoFocus
                        disabled={pending}
                      />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={pending || editingName.trim().length < 2} className="min-h-11 flex-1 sm:flex-none">
                          Guardar
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="min-h-11 flex-1 sm:flex-none" onClick={() => setEditingId(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex min-h-11 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-label-md text-label-md text-on-surface">
                        {category.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => beginEdit(category)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-muted hover:text-on-surface"
                        aria-label={`Editar ${category.name}`}
                      >
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`¿Archivar la categoría "${category.name}"? Sus servicios pasarán a Otros servicios.`)) return;
                          run(() => archiveServiceCategory(tenantSlug, category.id));
                        }}
                        disabled={pending}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-status-alert-bg hover:text-status-alert disabled:pointer-events-none disabled:opacity-50"
                        aria-label={`Archivar ${category.name}`}
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
        </div>
      )}
    </Card>
  );
}
