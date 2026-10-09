"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

/**
 * `agenda/nuevo/actions.ts` redirige acá con `?creado=1&mensaje=<texto ya
 * armado>` tras confirmar un turno (una server action no puede llamar
 * `useToast()` directamente). Mismo patrón que `demo-tour.tsx` para leer
 * un param de "recién llegado" y limpiarlo de la URL sin dejarlo pegado
 * (si no, un refresh de la página repite el toast).
 */
export function CreatedToast() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  useEffect(() => {
    if (searchParams.get("creado") !== "1") return;
    const mensaje = searchParams.get("mensaje");
    if (mensaje) toast.show(mensaje);
    const url = new URL(window.location.href);
    url.searchParams.delete("creado");
    url.searchParams.delete("mensaje");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr una vez, al montar
  }, []);

  return null;
}
