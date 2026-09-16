import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const PROBLEMAS = [
  {
    icon: "schedule_send",
    title: "Mensajes a deshoras",
    body: "Confirmar y recordar turnos a mano te come el día entero.",
  },
  {
    icon: "event_busy",
    title: "Sillón vacío o pérdida de plata",
    body: "Sin seña, los clientes no vienen y el hueco no se recupera.",
  },
  {
    icon: "receipt_long",
    title: "Caos administrativo en papel",
    body: "Planillas de caja, comisiones y clientes que no cierran solos.",
  },
];

const PLANES = [
  { nombre: "Solo", precio: "USD 15", detalle: "1 profesional, sin recepción" },
  { nombre: "Equipo", precio: "USD 35", detalle: "Hasta 5 profesionales + caja" },
  { nombre: "Pro", precio: "USD 69", detalle: "Hasta 15, 2 locales, reportes" },
];

export default function MarketingHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-2xl px-gutter py-2xl">
      <section className="flex flex-col items-center gap-lg text-center">
        <StatusPill status="pending">Diseñado para salones y barberías</StatusPill>
        <h1 className="max-w-2xl font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl">
          Multiplicá tus reservas y terminá con los turnos colgados
        </h1>
        <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
          TurnCreate es el SaaS de turnos, CRM y caja diseñado para barberías,
          salones y centros de estética de Argentina.
        </p>
        <Link href="/registro" className={buttonVariants({ size: "default" })}>
          Empezá tu prueba gratis de 7 días
          <Icon name="arrow_forward" className="text-[18px]" />
        </Link>
      </section>

      <section id="funciones" className="grid gap-lg md:grid-cols-3">
        {PROBLEMAS.map((problema) => (
          <Card key={problema.title} className="space-y-3 p-lg">
            <Icon name={problema.icon} className="text-[24px] text-secondary" />
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              {problema.title}
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {problema.body}
            </p>
          </Card>
        ))}
      </section>

      <section id="planes" className="grid gap-lg md:grid-cols-3">
        {PLANES.map((plan) => (
          <Card key={plan.nombre} className="space-y-2 p-lg text-center">
            <p className="font-label-lg text-label-lg text-on-surface-variant">
              Plan {plan.nombre}
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {plan.precio}
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {" "}
                /mes
              </span>
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {plan.detalle}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
