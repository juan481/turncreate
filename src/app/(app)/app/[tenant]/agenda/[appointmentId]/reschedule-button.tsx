"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RescheduleButton({
  tenantSlug,
  appointmentId,
  clientId,
  serviceId,
  staffId,
  dateISO,
  depositPaid,
}: {
  tenantSlug: string;
  appointmentId: string;
  clientId: string;
  // Servicio/profesional/día ORIGINALES del turno que se reprograma --
  // antes no se pasaban, así que "Nuevo turno" siempre arrancaba en
  // blanco al reprogramar (el usuario tenía que volver a elegir todo).
  // nuevo/page.tsx ya sabe leer estos mismos query params (serviceId,
  // staffId, date) como valores iniciales -- no hizo falta tocar nada ahí.
  serviceId: string;
  staffId: string;
  dateISO: string;
  depositPaid: number;
}) {
  const [asking, setAsking] = useState(false);
  const prefillParams = new URLSearchParams({ rescheduleFrom: appointmentId, clientId, date: dateISO });
  if (serviceId) prefillParams.set("serviceId", serviceId);
  if (staffId) prefillParams.set("staffId", staffId);
  const baseHref = `/app/${tenantSlug}/agenda/nuevo?${prefillParams.toString()}`;

  if (depositPaid <= 0) {
    return (
      <Link href={baseHref} className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-center")}>
        <Icon name="edit_calendar" className="text-[18px]" />
        Reprogramar
      </Link>
    );
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className={cn(buttonVariants({ variant: "secondary" }), "w-full justify-center")}
      >
        <Icon name="edit_calendar" className="text-[18px]" />
        Reprogramar
      </button>
    );
  }

  return (
    <div className="animate-fade-up space-y-3 rounded-inner border border-border bg-surface-container-low p-4">
      <div>
        <p className="font-label-lg text-label-lg text-on-surface">¿Qué hacemos con la seña de ${depositPaid.toLocaleString("es-AR")}?</p>
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Elegí cómo debe quedar el nuevo turno.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link
          href={`${baseHref}&keepDeposit=true`}
          className={cn(buttonVariants(), "min-h-12 w-full justify-center px-4 text-center")}
        >
          <Icon name="sync" className="text-[18px]" />
          Usar la misma seña
        </Link>
        <Link
          href={`${baseHref}&keepDeposit=false`}
          className={cn(buttonVariants({ variant: "secondary" }), "min-h-12 w-full justify-center px-4 text-center")}
        >
          <Icon name="money_off" className="text-[18px]" />
          Nuevo turno sin seña
        </Link>
      </div>
      <button type="button" onClick={() => setAsking(false)} className="min-h-11 w-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface">Volver</button>
    </div>
  );
}
