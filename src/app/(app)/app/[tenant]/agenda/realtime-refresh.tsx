"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/server/supabase/client";

/**
 * Sección 5.6: aviso en la app vía Realtime cuando cambia un turno del
 * día. Sin UI propia -- al recibir un evento, vuelve a pedir la página
 * al servidor (que ya trae los datos correctos con RLS) en vez de
 * duplicar la lógica de fetch/mapeo del lado del cliente.
 */
export function RealtimeAgendaRefresh({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`appointments-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `tenant_id=eq.${tenantId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, router]);

  return null;
}
