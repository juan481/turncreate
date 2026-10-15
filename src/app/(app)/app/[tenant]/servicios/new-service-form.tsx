"use client";

import { useActionState, useState } from "react";
import { createService, type ServiceActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import { PhasesEditor, type PhaseDraft } from "./phases-editor";

const initialState: ServiceActionState = { error: null };

const DEFAULT_PHASES: PhaseDraft[] = [{ kind: "active", minutes: 30 }];

export function NewServiceForm({
  tenantSlug,
  categories,
}: {
  tenantSlug: string;
  categories: ServiceCategoryRecord[];
}) {
  const [state, formAction, pending] = useActionState(
    createService.bind(null, tenantSlug),
    initialState,
  );
  const [phases, setPhases] = useState<PhaseDraft[]>(DEFAULT_PHASES);
  const [bufferAfterMin, setBufferAfterMin] = useState(0);

  return (
    <form action={formAction} className="space-y-md">
      <input type="hidden" name="phases" value={JSON.stringify(phases)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-service-name" className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
          <Input id="new-service-name" name="name" placeholder="Ej: Kapping en gel" maxLength={100} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="new-service-price" className="font-label-md text-label-md text-on-surface-variant">Precio</label>
          <Input id="new-service-price" name="price" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="$ 0" required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="new-service-category" className="font-label-md text-label-md text-on-surface-variant">Categoría</label>
          <select
            id="new-service-category"
            name="categoryId"
            defaultValue=""
            className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-lg text-body-lg text-on-surface outline-none ring-2 ring-transparent transition-all focus:bg-surface focus:ring-secondary"
          >
            <option value="">Otros servicios</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-inner bg-surface-container-low px-3 py-2.5">
          <input name="public" type="checkbox" defaultChecked className="h-5 w-5 shrink-0 accent-secondary" />
          <span>
            <span className="block font-label-md text-label-md text-on-surface">Visible en el turnero</span>
            <span className="block font-body-sm text-body-sm text-on-surface-variant">La clienta podrá elegirlo online.</span>
          </span>
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="new-service-description" className="font-label-md text-label-md text-on-surface-variant">Descripción para la clienta</label>
        <textarea
          id="new-service-description"
          name="description"
          rows={3}
          maxLength={600}
          placeholder="Contá brevemente qué incluye y para quién está recomendado."
          className="w-full resize-y rounded-inner border-0 bg-surface-muted px-4 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant outline-none ring-2 ring-transparent transition-all focus:bg-surface focus:ring-secondary"
        />
      </div>

      <PhasesEditor phases={phases} onChange={setPhases} />

      <div className="max-w-sm space-y-1.5">
        <label htmlFor="new-service-buffer" className="font-label-md text-label-md text-on-surface-variant">
          Limpieza después del turno
        </label>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Minutos que bloqueás en la agenda para ordenar o higienizar antes del próximo cliente. No se cobra.
        </p>
        <Input
          id="new-service-buffer"
          type="number"
          min="0"
          step="1"
          value={bufferAfterMin}
          onChange={(e) => setBufferAfterMin(Number(e.target.value) || 0)}
        />
        <input type="hidden" name="bufferAfterMin" value={bufferAfterMin} />
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creando…" : "Agregar servicio"}
      </Button>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
