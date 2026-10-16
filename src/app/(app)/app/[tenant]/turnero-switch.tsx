"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { updatePublicBookingEnabled } from "./configuracion/actions";
import { SwitchRow } from "./configuracion/switch-row";
import { TurneroCelebration } from "./turnero-celebration";

/**
 * Prender/pausar el turnero público (settings.publicBookingEnabled). Se usa
 * en el paso a paso del home y en Configuración → Link de reservas. Prender
 * solo se puede con los requisitos cumplidos (la server action lo vuelve a
 * chequear); pausar, siempre. Al prenderlo festeja con el link listo para copiar.
 */
export function TurneroSwitch({
  tenantSlug,
  enabled,
  ready,
  publicUrl,
  className,
}: {
  tenantSlug: string;
  enabled: boolean;
  ready: boolean;
  publicUrl: string;
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(enabled);
  const [celebrate, setCelebrate] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setChecked(next);
    startTransition(async () => {
      const result = await updatePublicBookingEnabled(tenantSlug, next);
      if (result.error) {
        setChecked(!next);
        toast.show(result.error, "error");
        return;
      }
      if (next) setCelebrate(true);
      else toast.show("Turnero pausado: tu página se ve, pero nadie puede reservar");
      router.refresh();
    });
  }

  return (
    <>
      <SwitchRow
        className={className}
        checked={checked}
        onChange={change}
        disabled={pending || (!checked && !ready)}
        title={checked ? "Turnero activo" : "Turnero apagado"}
        description={
          checked
            ? ready
              ? "Las clientas reservan y pagan la seña desde tu link."
              : "Activo, pero falta configurar cómo cobrar la seña para que puedan reservar."
            : ready
              ? "Prendelo para empezar a recibir reservas."
              : "Completá los pasos de arriba para poder prenderlo."
        }
      />
      {celebrate && <TurneroCelebration url={publicUrl} onClose={() => setCelebrate(false)} />}
    </>
  );
}
