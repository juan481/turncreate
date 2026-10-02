"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const SECTIONS: { icon: string; title: string; body: React.ReactNode }[] = [
  {
    icon: "storefront",
    title: "Este demo tiene 2 locales",
    body: (
      <>
        <strong>Estética Demo Solo</strong>: un solo profesional atiende, así que la agenda se ve
        como una lista simple. <strong>Estudio Demo Equipo</strong>: tres profesionales atienden a
        la vez, así que la agenda se ve en grilla, con una columna por persona. Cambiá de uno a
        otro con el selector de arriba a la izquierda (el nombre del local actual) para comparar
        las dos vistas.
      </>
    ),
  },
  {
    icon: "home",
    title: "Inicio",
    body: "Resumen del día: ingresos, próximo turno, el resto de la agenda de hoy, quién atendió más y cómo pagaron los clientes.",
  },
  {
    icon: "calendar_month",
    title: "Agenda",
    body: "Vista día, semana o mes. \"Nuevo turno\" pide cliente, profesional (o \"Cualquiera\"), servicio, fecha y hora. En la vista de equipo podés arrastrar un turno para reprogramarlo a otro horario o profesional.",
  },
  {
    icon: "group",
    title: "Clientes",
    body: "Listado con historial de turnos, notas y datos de contacto de cada persona que se atendió.",
  },
  {
    icon: "content_cut",
    title: "Servicios",
    body: "El catálogo del local: nombre, precio y duración de cada servicio.",
  },
  {
    icon: "badge",
    title: "Staff",
    body: "Solo aparece si hay más de un profesional. Altas, horario de cada uno, qué servicios atiende, foto (obligatoria) y comisión.",
  },
  {
    icon: "point_of_sale",
    title: "Caja",
    body: "Abrir y cerrar caja, cobrar turnos (efectivo, Mercado Pago, transferencia) y registrar movimientos sueltos.",
  },
  {
    icon: "link",
    title: "Turnero público",
    body: "Cada local tiene su propia página pública para que el cliente final reserve solo, sin hablar con nadie.",
  },
];

export function DemoTutorialModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get("demoTutorial") === "1");

  useEffect(() => {
    if (searchParams.get("demoTutorial") !== "1") return;
    // Saca el query param de la URL para que un refresh no vuelva a abrirlo
    // (el estado inicial de `open` ya se calculó arriba, esto solo limpia la URL).
    const url = new URL(window.location.href);
    url.searchParams.delete("demoTutorial");
    router.replace(url.pathname + url.search, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr una vez, al montar
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Cómo funciona este demo" maxWidth="34rem">
      <div className="space-y-lg">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Este usuario es compartido -- lo van a probar varias personas, por eso esta guía aparece
          cada vez que se inicia sesión con él.
        </p>

        <div className="space-y-md">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary">
                <Icon name={section.icon} className="text-[18px]" />
              </div>
              <div>
                <p className="font-label-lg text-label-lg text-on-surface">{section.title}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{section.body}</p>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" className="w-full" onClick={() => setOpen(false)}>
          Entendido, empezar
        </Button>
      </div>
    </Modal>
  );
}
