"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function TenantTypeInfoButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Por qué cambia la vista de agenda"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <Icon name="info" className="text-[16px]" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Los 2 tipos de local en TurnCreate" maxWidth="28rem">
        <div className="space-y-lg">
          <div className="flex gap-3 rounded-inner bg-surface-container-low p-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
              <Icon name="person" className="text-[20px]" />
            </div>
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">Local individual</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Un solo profesional atiende. La agenda se muestra como una <strong>lista simple</strong>,
                sin columnas, porque no hace falta comparar horarios entre varias personas.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-inner bg-surface-container-low p-md">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
              <Icon name="groups" className="text-[20px]" />
            </div>
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">Local de equipo</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Dos o más profesionales atienden en simultáneo. La agenda se muestra en{" "}
                <strong>grilla, con una columna por profesional</strong>, para ver a todo el equipo a la vez.
              </p>
            </div>
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant">
            El tipo se decide solo según cuántos profesionales activos tiene el local — no hay que
            configurar nada. Si tenés más de un local, podés pasar de uno a otro (y ver las dos
            vistas) desde el selector con el nombre del local, arriba a la izquierda.
          </p>

          <Button type="button" className="w-full" onClick={() => setOpen(false)}>
            Entendido
          </Button>
        </div>
      </Modal>
    </>
  );
}
