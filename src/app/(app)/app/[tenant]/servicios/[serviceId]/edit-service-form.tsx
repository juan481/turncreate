"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import { PhasesEditor, type PhaseDraft } from "../phases-editor";
import { updateService, setServiceActive, archiveService, type ServiceActionState } from "../actions";

const initialState: ServiceActionState = { error: null };

export function EditServiceForm({
  tenantSlug,
  service,
  categories,
}: {
  tenantSlug: string;
  categories: ServiceCategoryRecord[];
  service: {
    id: string;
    name: string;
    price: number;
    active: boolean;
    public: boolean;
    description: string;
    categoryId: string | null;
    bufferAfterMin: number;
    phases: PhaseDraft[];
  };
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateService.bind(null, tenantSlug, service.id),
    initialState,
  );
  const [phases, setPhases] = useState<PhaseDraft[]>(service.phases);
  const [bufferAfterMin, setBufferAfterMin] = useState(service.bufferAfterMin);
  const [active, setActive] = useState(service.active);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [archiving, startArchiving] = useTransition();
  const [togglingActive, startTogglingActive] = useTransition();

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    setOperationError(null);
    startTogglingActive(async () => {
      const result = await setServiceActive(tenantSlug, service.id, next);
      if (result.error) {
        setActive(!next);
        setOperationError(result.error);
      }
    });
  }

  function handleArchive() {
    if (!confirm(`¿Archivar "${service.name}"? Ya no va a aparecer en el turnero ni en el catálogo.`)) return;
    startArchiving(async () => {
      const result = await archiveService(tenantSlug, service.id);
      if (result.error) {
        setOperationError(result.error);
        return;
      }
      router.push(`/app/${tenantSlug}/servicios`);
    });
  }

  return (
    <form action={formAction} className="space-y-md">
      <input type="hidden" name="phases" value={JSON.stringify(phases)} />

      <div className="flex items-center justify-between rounded-inner bg-surface-container-low p-3">
        <span className="font-label-md text-label-md text-on-surface">
          {active ? "Servicio activo" : "Servicio inactivo"}
        </span>
        <button
          type="button"
          onClick={handleToggleActive}
          disabled={togglingActive}
          className={`flex h-11 w-14 items-center rounded-pill p-1.5 transition-colors ${active ? "justify-end bg-status-confirmed-dot" : "justify-start bg-surface-container-high"}`}
          aria-label="Activar o desactivar servicio"
        >
          <span className="h-6 w-6 rounded-full bg-surface-container-lowest shadow-card" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="edit-service-name" className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
          <Input id="edit-service-name" name="name" defaultValue={service.name} maxLength={100} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="edit-service-price" className="font-label-md text-label-md text-on-surface-variant">Precio</label>
          <Input id="edit-service-price" name="price" type="number" min="0.01" step="0.01" inputMode="decimal" defaultValue={service.price} required />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="edit-service-category" className="font-label-md text-label-md text-on-surface-variant">Categoría</label>
          <select
            id="edit-service-category"
            name="categoryId"
            defaultValue={service.categoryId ?? ""}
            className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-lg text-body-lg text-on-surface outline-none ring-2 ring-transparent transition-all focus:bg-surface focus:ring-secondary"
          >
            <option value="">Otros servicios</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-inner bg-surface-container-low px-3 py-2.5">
          <input name="public" type="checkbox" defaultChecked={service.public} className="h-5 w-5 shrink-0 accent-secondary" />
          <span>
            <span className="block font-label-md text-label-md text-on-surface">Visible en el turnero</span>
            <span className="block font-body-sm text-body-sm text-on-surface-variant">La clienta podrá elegirlo online.</span>
          </span>
        </label>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="edit-service-description" className="font-label-md text-label-md text-on-surface-variant">Descripción para la clienta</label>
        <textarea
          id="edit-service-description"
          name="description"
          rows={3}
          maxLength={600}
          defaultValue={service.description}
          placeholder="Contá brevemente qué incluye y para quién está recomendado."
          className="w-full resize-y rounded-inner border-0 bg-surface-muted px-4 py-3 font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant outline-none ring-2 ring-transparent transition-all focus:bg-surface focus:ring-secondary"
        />
      </div>

      <PhasesEditor phases={phases} onChange={setPhases} />

      <div className="max-w-sm space-y-1.5">
        <label htmlFor="edit-service-buffer" className="font-label-md text-label-md text-on-surface-variant">Limpieza después del turno</label>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Minutos que bloqueás en la agenda para ordenar o higienizar antes del próximo cliente. No se cobra.
        </p>
        <Input
          id="edit-service-buffer"
          type="number"
          min="0"
          step="1"
          value={bufferAfterMin}
          onChange={(e) => setBufferAfterMin(Number(e.target.value) || 0)}
        />
        <input type="hidden" name="bufferAfterMin" value={bufferAfterMin} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-md">
        <button
          type="button"
          onClick={handleArchive}
          disabled={archiving}
          className="flex min-h-11 items-center gap-1.5 rounded-pill px-2 font-label-md text-label-md text-status-alert transition-colors hover:bg-status-alert-bg"
        >
          <Icon name="delete" className="text-[16px]" />
          {archiving ? "Archivando…" : "Archivar servicio"}
        </button>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      {operationError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{operationError}</p>}
    </form>
  );
}
