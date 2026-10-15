"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { ServiceCategoryRecord } from "@/server/services/catalog";
import { ServiceFields } from "../service-fields";
import { updateService, setServiceActive, archiveService } from "../actions";

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
    durationMin: number;
  };
}) {
  const router = useRouter();
  const toast = useToast();
  const [active, setActive] = useState(service.active);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [archiving, startArchiving] = useTransition();
  const [togglingActive, startTogglingActive] = useTransition();
  const listHref = `/app/${tenantSlug}/servicios`;

  function handleToggleActive() {
    const next = !active;
    setActive(next);
    setError(null);
    startTogglingActive(async () => {
      const result = await setServiceActive(tenantSlug, service.id, next);
      if (result.error) {
        setActive(!next);
        setError(result.error);
        return;
      }
      toast.show(next ? "Servicio activado" : "Servicio pausado");
    });
  }

  function handleArchive() {
    if (!confirm(`¿Archivar "${service.name}"? Ya no va a aparecer en el turnero ni en el catálogo.`)) return;
    startArchiving(async () => {
      const result = await archiveService(tenantSlug, service.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.show("Servicio archivado");
      router.push(listHref);
    });
  }

  return (
    <form
      className="space-y-lg"
      action={(formData) =>
        startSaving(async () => {
          setError(null);
          const result = await updateService(tenantSlug, service.id, { error: null }, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          toast.show("¡Cambios guardados!");
          router.push(listHref);
        })
      }
    >
      <div className="flex items-center justify-between rounded-inner bg-surface-container-low p-3">
        <span className="font-label-md text-label-md text-on-surface">
          {active ? "Servicio activo" : "Servicio pausado"}
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

      <ServiceFields
        tenantSlug={tenantSlug}
        categories={categories}
        defaults={{
          name: service.name,
          price: service.price,
          durationMin: service.durationMin,
          categoryId: service.categoryId,
          description: service.description,
          public: service.public,
        }}
      />

      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}

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
        <Button type="submit" disabled={saving} className="w-full sm:w-auto">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
