import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";

type Faq = { q: string; a: string };

const SECTIONS: { title: string; icon: string; faqs: Faq[] }[] = [
  {
    title: "Primeros pasos",
    icon: "auto_awesome",
    faqs: [
      {
        q: "¿Cómo comparto mi turnero con mis clientas?",
        a: "En Inicio tocá \"Link público\" y se copia solo. Pegalo en la bio de Instagram, en tu estado de WhatsApp o mandáselo directo a quien te pida turno.",
      },
      {
        q: "Mis clientas ven \"Reservas online en preparación\". ¿Por qué?",
        a: "El turnero público se habilita recién cuando conectás Mercado Pago, porque toda reserva online pide seña. Andá a Configuración → Mercado Pago → Conectar y listo: se activa al toque.",
      },
      {
        q: "¿Cómo cargo mi logo?",
        a: "En Configuración → Datos del negocio tocá \"Subir logo\" y elegí una imagen de tu celular o computadora (hasta 2 MB). Se ve en tu panel y en el turnero de tus clientas.",
      },
    ],
  },
  {
    title: "Servicios",
    icon: "content_cut",
    faqs: [
      {
        q: "¿Cómo cargo un servicio nuevo?",
        a: "Servicios → Nuevo servicio. Con nombre, precio y duración alcanza. La categoría es opcional: si no elegís ninguna queda en \"Otros servicios\".",
      },
      {
        q: "¿Puedo cambiar el orden en que aparecen?",
        a: "Sí. En Servicios arrastrá cada uno desde el ícono de los puntitos. El orden que dejes es exactamente el que ve tu clienta en el turnero. Si arrastrás una categoría, se mueve con todos sus servicios.",
      },
      {
        q: "¿Cómo destaco un servicio?",
        a: "Tocá la estrellita del servicio en la lista. Los destacados se ven resaltados en tu turnero para que llamen más la atención.",
      },
      {
        q: "¿Puedo dejar un servicio solo para mí, sin que se pueda reservar online?",
        a: "Sí. Al editarlo destildá \"Visible en el turnero\". Lo seguís usando para agendar a mano, pero no aparece en el link público.",
      },
    ],
  },
  {
    title: "Turnos y cobros",
    icon: "event",
    faqs: [
      {
        q: "¿Cómo agendo un turno a mano (por WhatsApp o en el local)?",
        a: "Con el botón + de la barra de abajo. Elegís clienta, servicio y horario, y si ya te pagó la seña la registrás en efectivo o transferencia.",
      },
      {
        q: "¿Cuánto cobro de seña?",
        a: "Lo definís vos en Configuración → Política de seña: un monto fijo o un porcentaje del servicio. La seña se acredita directo en tu cuenta de Mercado Pago.",
      },
      {
        q: "¿Qué pasa si dos clientas quieren el mismo horario a la vez?",
        a: "Mientras una paga, el horario queda reservado 10 minutos para ella. Si no termina de pagar, se libera solo. Nunca vas a tener dos turnos pisados.",
      },
      {
        q: "¿Cómo cobro el resto del turno cuando la clienta viene?",
        a: "Abrí el turno desde la Agenda y tocá Cobrar. Podés registrar efectivo, transferencia, Posnet o Mercado Pago; queda todo sumado en la Caja del día.",
      },
    ],
  },
  {
    title: "Configuración",
    icon: "settings",
    faqs: [
      {
        q: "¿Cómo cambio mis días y horarios de atención?",
        a: "Configuración → Horarios de atención. Podés cortar al mediodía (horario partido) y marcar los días que no abrís.",
      },
      {
        q: "¿Puedo sumar a otra persona que trabaje conmigo?",
        a: "Sí, desde Configuración → Equipo. Cuando hay más de una profesional, la agenda y el turnero se organizan por persona.",
      },
    ],
  },
];

export default async function AyudaPage({ params }: PageProps<"/app/[tenant]/ayuda">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) notFound();

  const whatsappHref = `https://wa.me/541124527669?text=${encodeURIComponent(
    `Hola, necesito ayuda con ${tenant.name} (${tenant.slug}) en TurnCreate.`,
  )}`;

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div className="hidden lg:block">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Ayuda</h1>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Las dudas más comunes, resueltas en un minuto. Si no encontrás la tuya, escribinos y te respondemos nosotros.
      </p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-2" aria-labelledby={`faq-${section.icon}`}>
          <h2 id={`faq-${section.icon}`} className="flex items-center gap-2 px-1 font-label-md text-label-md uppercase tracking-wide text-on-surface-variant">
            <Icon name={section.icon} className="text-[16px] text-secondary" />
            {section.title}
          </h2>
          <Card hoverLift={false} className="divide-y divide-border p-0">
            {section.faqs.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-label-lg text-label-lg text-on-surface [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">{faq.q}</span>
                  <Icon name="expand_more" className="shrink-0 text-[20px] text-on-surface-variant transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="px-4 pb-4 font-body-md text-body-md text-on-surface-variant">{faq.a}</p>
              </details>
            ))}
          </Card>
        </section>
      ))}

      <Card hoverLift={false} className="space-y-3 border-primary/20 bg-primary/5 p-lg text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary-soft text-secondary">
          <Icon name="chat" className="text-[22px]" />
        </span>
        <div>
          <p className="font-headline-sm text-headline-sm text-on-surface">¿No encontraste lo que buscabas?</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Escribinos por WhatsApp y te ayudamos nosotros.</p>
        </div>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants(), "w-full sm:w-auto")}>
          Hablar con soporte
        </a>
      </Card>
    </div>
  );
}
