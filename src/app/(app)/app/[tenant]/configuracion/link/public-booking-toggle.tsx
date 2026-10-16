"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { updatePublicBookingEnabled } from "../actions";
import { SwitchRow } from "../switch-row";

/**
 * Prender/pausar las reservas online. Prender solo se puede con los
 * requisitos cumplidos (la server action lo vuelve a chequear); pausar,
 * siempre.
 */
export function PublicBookingToggle({ tenantSlug, enabled, ready }: { tenantSlug: string; enabled: boolean; ready: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(enabled);
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
      toast.show(next ? "Tu turnero ya toma reservas" : "Reservas online pausadas");
      router.refresh();
    });
  }

  return (
    <SwitchRow
      checked={checked}
      onChange={change}
      disabled={pending || (!checked && !ready)}
      title="Tomar reservas online"
      description={
        checked
          ? ready
            ? "Activo: las clientas reservan y pagan la seña desde tu link."
            : "Activo, pero todavía falta algo de la lista de abajo para que puedan reservar."
          : ready
            ? "Pausado: tu página se ve, pero nadie puede reservar."
            : "Completá lo de abajo para poder activarlo."
      }
    />
  );
}
