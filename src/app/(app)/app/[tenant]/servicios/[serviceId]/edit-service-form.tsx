"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhasesEditor, type PhaseDraft } from "../phases-editor";
import { updateService, setServiceActive, archiveService, type ServiceActionState } from "../actions";

const initialState: ServiceActionState = { error: null };

export function EditServiceForm({
  tenantSlug,
  service,
}: {
  tenantSlug: string;
  service: {
    id: string;
    name: string;
    price: number;
    active: boolean;
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
  const [archiving, startArchiving] = useTransition();
  const [togglingActive, startTogglingActive] = useTransition();

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    startTogglingActive(async () => {
      await setServiceActive(tenantSlug, service.id, next);
    });
  }

  function handleArchive() {
    if (!confirm(`¿Archivar "${service.name}"? Ya no va a aparecer en el turnero ni en el catálogo.`)) return;
    startArchiving(async () => {
      await archiveService(tenantSlug, service.id);
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
          className={`flex h-7 w-12 items-center rounded-pill p-1 transition-colors ${active ? "justify-end bg-status-confirmed-dot" : "justify-start bg-surface-container-high"}`}
          aria-label="Activar o desactivar servicio"
        >
          <span className="h-5 w-5 rounded-full bg-surface-container-lowest shadow-card" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">Nombre</label>
          <Input name="name" defaultValue={service.name} required />
        </div>
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">Precio</label>
          <Input name="price" type="number" min="0" step="0.01" defaultValue={service.price} required />
        </div>
      </div>

      <PhasesEditor phases={phases} onChange={setPhases} />

      <div className="max-w-[220px] space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Limpieza después del turno</label>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Minutos que bloqueás en la agenda para ordenar o higienizar antes del próximo cliente. No se cobra.
        </p>
        <Input
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
          className="flex items-center gap-1.5 font-label-md text-label-md text-status-alert transition-colors hover:underline"
        >
          <Icon name="delete" className="text-[16px]" />
          {archiving ? "Archivando…" : "Archivar servicio"}
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}
