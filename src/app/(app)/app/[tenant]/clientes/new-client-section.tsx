"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { NewClientForm } from "./new-client-form";

/**
 * Encabezado de Clientes + formulario desplegable de "Nuevo cliente".
 * Mismo aspecto que SectionHeaderNew, pero controlable desde la URL: el
 * acceso "Nuevo cliente" del botón flotante entra a `/clientes?nuevo=1`
 * y el formulario se abre solo. Apenas se abre, el parámetro se limpia
 * con router.replace (sin sumar historial), así que ni el atrás ni un
 * refresh lo vuelven a abrir. Si se vuelve a tocar el acceso estando ya
 * en Clientes, el servidor manda `requestedOpen` de nuevo y se reabre.
 */
export function NewClientSection({
  tenantSlug,
  subtitle,
  requestedOpen,
}: {
  tenantSlug: string;
  subtitle: string;
  requestedOpen: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(requestedOpen);
  const cardRef = useRef<HTMLDivElement>(null);

  // Ajuste de estado durante el render (sin efecto): cada vez que llega un
  // pedido nuevo de abrir, se abre.
  const [prevRequested, setPrevRequested] = useState(requestedOpen);
  if (requestedOpen !== prevRequested) {
    setPrevRequested(requestedOpen);
    if (requestedOpen) setOpen(true);
  }

  useEffect(() => {
    if (!requestedOpen) return;
    router.replace(pathname, { scroll: false });
    cardRef.current?.scrollIntoView({ block: "nearest" });
  }, [requestedOpen, pathname, router]);

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* El AppBar mobile ya muestra el título -- el <h1> es solo desktop. */}
        <div className="hidden lg:block">
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Clientes</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant lg:hidden">{subtitle}</p>
        {!open && (
          <Button size="default" onClick={() => setOpen(true)}>
            <Icon name="add" className="text-[18px]" />
            Nuevo cliente
          </Button>
        )}
      </div>

      {open && (
        <Card ref={cardRef} hoverLift={false} className="scroll-mt-24 animate-fade-up p-lg motion-reduce:animate-none">
          <div className="mb-md flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
                <Icon name="person_add" className="text-[18px]" />
              </span>
              <h2 className="truncate font-headline-sm text-headline-sm text-on-surface">Nuevo cliente</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
              aria-label="Cerrar"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
          <NewClientForm tenantSlug={tenantSlug} />
        </Card>
      )}
    </div>
  );
}
