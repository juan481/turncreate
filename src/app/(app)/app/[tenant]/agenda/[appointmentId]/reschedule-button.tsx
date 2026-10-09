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
    <div className="animate-fade-up space-y-2 rounded-inner bg-surface-container-low p-3">
      <p className="font-label-md text-label-md text-on-surface">
        Este turno ya tiene una seña pagada de ${depositPaid.toLocaleString("es-AR")}. ¿La mantenemos en el turno nuevo?
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href={`${baseHref}&keepDeposit=true`}
          className={cn(buttonVariants({ size: "sm" }), "flex-1 justify-center")}
        >
          Mantener seña
        </Link>
        <Link
          href={`${baseHref}&keepDeposit=false`}
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "flex-1 justify-center")}
        >
          Sin seña
        </Link>
      </div>
    </div>
  );
}
