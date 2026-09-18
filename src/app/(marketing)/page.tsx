import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { FeatureShowcase } from "./feature-showcase";
import { cn } from "@/lib/utils";

const STATS = [
  { value: "70%", label: "menos ausentismo", detail: "cobrando seña antes de confirmar el turno" },
  { value: "24/7", label: "turnero abierto", detail: "tus clientes reservan solos, aunque estés cerrado" },
  { value: "1 clic", label: "para cobrar con MP", detail: "el dinero se acredita directo en tu cuenta" },
  { value: "1 o 20", label: "profesionales", detail: "el mismo sistema te sirve solo o con todo un equipo" },
];

const PROBLEMAS = [
  {
    icon: "schedule_send",
    title: "Mensajes a deshoras",
    body: "¿Cansado de responder mensajes a las 11 de la noche para dar un turno? Clientes preguntando precios y horarios a deshoras mientras vos intentás descansar.",
  },
  {
    icon: "event_busy",
    title: "Sillón vacío y pérdida de plata",
    body: "¿Te frustra perder plata y tiempo valioso cuando un cliente te deja plantado a último momento? Silla vacía, profesional desocupado y costos fijos que corren igual.",
  },
  {
    icon: "receipt_long",
    title: "Caos administrativo en papel",
    body: "Planillas de papel, cruces de horarios y comisiones calculadas a ojo al final del mes. El caos administrativo te roba horas de tu vida.",
  },
];

const BENEFICIOS = [
  {
    span: "lg:col-span-7",
    badge: "Cobro Blindado",
    icon: "payments",
    title: "Ausentismo Cero con Señas Inteligentes",
    body: "Elegí cómo cobrar la seña: un porcentaje del servicio, un monto fijo, o decidilo turno por turno a mano. Conectá tu cuenta de Mercado Pago con un clic y la plata se acredita directo, sin intermediarios. Si el cliente cancela fuera de término, el sistema la retiene automáticamente.",
  },
  {
    span: "lg:col-span-5",
    badge: "Autogestión 24/7",
    icon: "link",
    title: "Tu propia recepcionista 24/7",
    body: "Olvidate de cruzar horarios a mano. Tus clientes entran a tu link personalizado, eligen el servicio, el profesional (o vos, si trabajás solo/a), la fecha y pagan la seña en 4 simples pasos, sin que vos tengas que intervenir.",
  },
  {
    span: "lg:col-span-4",
    badge: "WhatsApp API Oficial",
    icon: "forum",
    title: "Recordatorios por WhatsApp Automáticos",
    body: "El sistema envía una confirmación inmediata y un recordatorio 24 horas antes directo al WhatsApp del cliente, bajando drásticamente la tasa de no-shows.",
  },
  {
    span: "lg:col-span-4",
    badge: "Caja & Finanzas",
    icon: "point_of_sale",
    title: "Control Total de la Caja y tu Equipo",
    body: "Administrá la apertura y cierre de caja diaria, registrá pagos mixtos (efectivo, transferencia, tarjeta) y automatizá la liquidación de comisiones para cada profesional — funciona igual si sos vos solo/a o si sumás todo un equipo.",
  },
  {
    span: "lg:col-span-4",
    badge: "CRM & Ficha",
    icon: "clinical_notes",
    title: "Conocé a tus clientes a fondo",
    body: "Armá un historial de cada visita, llevá el control de ausencias y registrá notas clínicas confidenciales (ideal para cosmiatría y estética).",
  },
];

const VERTICALES = [
  { emoji: "✂️", tag: "Ritmo Ágil", title: "Barberías y Peluquerías", body: "Control de sillones, turnos de 30-45 min, barberos con comisión y venta rápida de pomadas en mostrador.", footer: "Sillones en paralelo" },
  { emoji: "💆‍♀️", tag: "Cabinas & Fichas", title: "Centros de Cosmiatría y Estética", body: "Ficha clínica de piel, tiempos de aparatología y cabina, consentimiento informado y señas obligatorias.", footer: "Gestión de aparatología" },
  { emoji: "💅", tag: "Mesas & Retoques", title: "Salones de Uñas y Pestañas", body: "Gestión de mesas de manicuría, citas recurrentes cada 21 días y cálculo de insumos por servicio.", footer: "Reagendamiento cada 21 días" },
  { emoji: "🧘‍♀️", tag: "Profesionales Libres", title: "Spas y Profesionales Independientes", body: "Modo autónomo, agenda despejada y link directo en la bio de Instagram para que nadie te distraiga en sesión.", footer: "Link directo para Instagram Bio" },
];

const PASOS = [
  { title: "El cliente entra a tu web", body: "Ingresa a tu turnero público desde Instagram o WhatsApp y ve los horarios disponibles en tiempo real.", tag: "turncreate.com.ar/tu-marca" },
  { title: "Reserva en segundos", body: "Selecciona el servicio y su profesional favorito con duración y valor transparente.", tag: "Sin apps que descargar" },
  { title: "Asegura con Mercado Pago", body: "Paga la seña directamente en la plataforma, y el dinero va a tu propia cuenta de Mercado Pago al instante.", tag: "Dinero disponible de inmediato" },
  { title: "Confirmación instantánea", body: "El turno se bloquea en tu agenda y el cliente recibe un WhatsApp confirmando su cita.", tag: "Recordatorio 24hs antes" },
];

const PLANES = [
  {
    nombre: "Solo",
    precio: "$19.900",
    detalle: "Para profesionales independientes.",
    features: ["Turnero online personalizado", "Cobro de señas con Mercado Pago", "Agenda digital inteligente", "Historial completo de clientes", "150 mensajes de WhatsApp mensuales"],
    cta: "Empezar con Solo",
    featured: false,
  },
  {
    nombre: "Equipo",
    precio: "$34.900",
    detalle: "Ideal para locales con staff y recepcionista.",
    features: ["Hasta 5 profesionales con agenda propia", "Accesos y permisos para recepcionista", "Arqueo y control de caja diaria", "Mini POS para venta de productos", "Comisiones automáticas", "600 notificaciones de WhatsApp"],
    cta: "Probar 7 días gratis",
    featured: true,
  },
  {
    nombre: "Pro",
    precio: "$54.900",
    detalle: "Para los que van por todo.",
    features: ["Hasta 15 profesionales en el staff", "Gestión multi-sucursal (2 locales)", "Dominio propio", "Número de WhatsApp exclusivo de tu marca", "Seguimiento post-turno y reportes avanzados"],
    cta: "Contactar Ventas",
    featured: false,
  },
];

const AGENDA_PREVIEW = [
  { hora: "12:00", nombre: "Mateo Rossi", servicio: "Corte Degradé + Perfilado de Barba", tag: "Barbero: Nico", seed: "mateo-rossi" },
  { hora: "13:15", nombre: "Luciana Morales", servicio: "Kapping Gel + Esmaltado Semipermanente", tag: "Mesa 2: Vale", seed: "luciana-morales" },
  { hora: "14:30", nombre: "Agustina Méndez", servicio: "Radiofrecuencia Facial + Masaje Kobido", tag: "Cabina 1: Andrea", seed: "agustina-mendez" },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-xs rounded-pill bg-surface-container px-4 py-1.5 font-label-md text-label-md text-secondary">
      {children}
    </span>
  );
}

export default function MarketingHomePage() {
  return (
    <div className="flex w-full flex-col">
      {/* HERO */}
      <section className="relative w-full overflow-hidden px-gutter py-2xl md:px-gutter-desktop">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 flex items-start justify-center">
          <div className="animate-float-slow absolute -left-16 top-0 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="animate-float-slow-delayed absolute -right-10 top-16 h-72 w-72 rounded-full bg-tertiary/20 blur-3xl" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col items-center text-center">
          <StatusPill status="pending" className="mb-lg animate-fade-up">
            Diseñado para barberías, salones y estética en Argentina
          </StatusPill>

          <h1
            className="max-w-4xl animate-fade-up text-balance font-headline-xl-mobile text-headline-xl-mobile text-on-surface md:font-headline-xl md:text-headline-xl"
            style={{ animationDelay: "80ms" }}
          >
            Multiplicá tus reservas y terminá con los turnos colgados.
          </h1>
          <p
            className="mb-xl mt-md max-w-[42rem] animate-fade-up text-balance font-body-lg text-body-lg text-on-surface-variant"
            style={{ animationDelay: "160ms" }}
          >
            TurnCreate es el SaaS integral de turnos, CRM y caja diseñado exclusivamente para barberías, salones y
            centros de estética. Automatizá tu agenda, cobrá señas al instante y tomá el control de tu negocio.
          </p>

          <div
            className="flex w-full animate-fade-up flex-col items-center gap-md sm:w-auto sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link href="/registro" className={cn(buttonVariants({ size: "default" }), "group h-12 w-full px-xl sm:w-auto")}>
              Empezá tu prueba gratis de 7 días
              <Icon name="arrow_forward" className="text-[18px] transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#como-funciona"
              className={cn(buttonVariants({ variant: "secondary", size: "default" }), "h-12 w-full px-xl sm:w-auto")}
            >
              <Icon name="calendar_month" className="text-[20px] text-secondary" />
              Ver demo (Turnero de ejemplo)
            </Link>
          </div>

          <div
            className="mt-lg flex animate-fade-up flex-wrap items-center justify-center gap-x-md gap-y-xs font-body-sm text-body-sm text-on-surface-variant"
            style={{ animationDelay: "300ms" }}
          >
            <span className="flex items-center gap-1.5">
              <Icon name="check_circle" className="text-[16px] text-secondary" /> No requiere tarjeta de crédito
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1.5">
              <Icon name="bolt" className="text-[16px] text-secondary" /> Activación en 15 minutos
            </span>
            <span className="text-outline-variant">•</span>
            <span className="flex items-center gap-1.5">
              <Icon name="verified_user" className="text-[16px] text-secondary" /> Sin contratos de permanencia
            </span>
          </div>

          {/* Dashboard showcase */}
          <div className="relative mt-2xl w-full pt-xs">
            <div className="absolute -left-4 top-16 z-20 hidden animate-float-slow items-center gap-sm rounded-pill bg-surface-container-lowest/95 px-lg py-md shadow-card-hover backdrop-blur-md lg:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-soft font-label-md text-label-md text-secondary">
                +92%
              </div>
              <div className="text-left">
                <p className="font-label-sm text-label-sm text-on-surface">Asistencia confirmada</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Sin ausentismo no-show</p>
              </div>
            </div>
            <div className="absolute -right-4 top-28 z-20 hidden animate-float-slow-delayed items-center gap-sm rounded-pill bg-surface-container-lowest/95 px-lg py-md shadow-card-hover backdrop-blur-md lg:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-status-confirmed">
                <Icon name="payments" className="text-[18px]" />
              </div>
              <div className="text-left">
                <p className="font-label-sm text-label-sm text-on-surface">Cobros directos a tu Mercado Pago</p>
                <p className="font-body-sm text-body-sm text-status-confirmed">Acreditación instantánea</p>
              </div>
            </div>

            <div className="w-full rounded-card bg-surface-container-lowest p-md text-left shadow-card-hover md:p-xl">
              <div className="flex flex-wrap items-center justify-between gap-sm pb-md">
                <div className="flex items-center gap-md">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary">
                    <Icon name="dashboard" className="text-[18px]" />
                  </div>
                  <div>
                    <p className="font-headline-sm text-headline-sm text-on-surface">Panel de Control en Vivo</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Studio Lumière · Palermo</p>
                  </div>
                </div>
                <div className="flex items-center gap-xs rounded-pill bg-surface-container-low p-1">
                  <span className="rounded-pill bg-primary px-3 py-1 font-label-sm text-label-sm text-on-primary shadow-sm">
                    Hoy · Jueves
                  </span>
                  <span className="px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">Viernes</span>
                  <span className="px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">Sábado</span>
                </div>
              </div>

              <div className="mt-xs grid grid-cols-1 gap-md lg:grid-cols-12">
                <div className="flex flex-col gap-sm lg:col-span-4">
                  <div className="rounded-inner bg-surface-container-low p-md">
                    <div className="mb-sm flex items-center justify-between">
                      <span className="font-label-md text-label-md text-on-surface">Turno en Atención</span>
                      <StatusPill status="confirmed">Confirmado</StatusPill>
                    </div>
                    <div className="my-xs flex items-center gap-md">
                      <Avatar name="Camila Ferraro" src="https://i.pravatar.cc/150?u=camila-ferraro-landing" size="lg" />
                      <div>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface">Camila Ferraro</h4>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">Limpieza Facial + Dermaplaning</p>
                      </div>
                    </div>
                    <div className="mt-xs flex items-center justify-between pt-sm">
                      <div className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface">
                        <Icon name="schedule" className="text-[18px] text-secondary" /> 10:30 - 11:45 hs
                      </div>
                      <span className="rounded-pill bg-secondary-soft px-3 py-0.5 font-label-sm text-label-sm text-secondary">
                        Lucía Valenzuela
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-md rounded-inner bg-surface-container-lowest p-md shadow-card">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-confirmed text-on-primary">
                      <Icon name="chat" className="text-[20px]" />
                    </div>
                    <div className="flex flex-col">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-label-sm text-label-sm font-bold text-on-surface">WhatsApp TurnCreate</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">Hace 2 min</span>
                      </div>
                      <p className="font-body-sm text-body-sm leading-snug text-on-surface">
                        &ldquo;¡Hola Camila! Tu turno para Limpieza Facial está confirmado para el Jueves 10:30 hs. Seña
                        de $11.000 recibida con Mercado Pago ✓&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-sm lg:col-span-8">
                  <div className="grid grid-cols-3 gap-sm">
                    <div className="rounded-inner bg-surface-container-low p-md">
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Turnos del Día</p>
                      <p className="mt-1 font-headline-lg text-headline-lg text-on-surface">
                        24 <span className="font-body-sm text-body-sm font-medium text-status-confirmed">100% cubierto</span>
                      </p>
                    </div>
                    <div className="rounded-inner bg-surface-container-low p-md">
                      <p className="font-body-sm text-body-sm text-on-surface-variant">Señas Cobradas (MP)</p>
                      <p className="mt-1 font-headline-lg text-headline-lg text-on-surface">$264.000</p>
                    </div>
                    <div className="rounded-inner bg-surface-container-low p-md">
                      <p className="font-body-sm text-body-sm text-on-surface-variant">No-Shows</p>
                      <p className="mt-1 font-headline-lg text-headline-lg text-secondary">
                        0% <span className="font-body-sm text-body-sm text-on-surface-variant">blindado</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-xs rounded-inner bg-surface-container-low p-md">
                    <div className="flex items-center justify-between pb-xs">
                      <span className="font-label-md text-label-md text-on-surface">Próximos turnos programados</span>
                      <span className="font-label-sm text-label-sm text-secondary">Ver calendario completo →</span>
                    </div>
                    {AGENDA_PREVIEW.map((row) => (
                      <div
                        key={row.hora}
                        className="flex items-center justify-between rounded-inner bg-surface-container-lowest p-sm shadow-card"
                      >
                        <div className="flex items-center gap-md">
                          <span className="w-14 font-label-md text-label-md text-on-surface">{row.hora}</span>
                          <Avatar name={row.nombre} src={`https://i.pravatar.cc/150?u=${row.seed}`} size="sm" />
                          <div>
                            <p className="font-label-md text-label-md text-on-surface">{row.nombre}</p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant">{row.servicio}</p>
                          </div>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex">
                          <span className="rounded-pill bg-surface-container px-3 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                            {row.tag}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS DE IMPACTO */}
      <section className="w-full px-gutter py-xl md:px-gutter-desktop">
        <Reveal>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-md rounded-card border border-border bg-surface-container-lowest p-lg shadow-card md:grid-cols-4 md:p-xl">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1 text-center">
                <span className="font-headline-xl text-headline-xl text-secondary">{stat.value}</span>
                <span className="font-label-md text-label-md text-on-surface">{stat.label}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{stat.detail}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* PROBLEMA */}
      <section className="w-full bg-surface-container-low px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto flex max-w-6xl flex-col items-center">
          <div className="mb-md inline-flex items-center gap-xs rounded-pill bg-error-container px-4 py-1.5 font-label-md text-label-md text-on-error-container">
            <Icon name="warning" className="text-[16px]" />
            El dolor del dueño del salón
          </div>
          <h2 className="mb-xl max-w-3xl text-center font-headline-lg text-headline-lg text-on-surface">
            Gestionar un salón no debería ser un dolor de cabeza constante
          </h2>
          <div className="grid w-full grid-cols-1 gap-lg md:grid-cols-3">
            {PROBLEMAS.map((problema, i) => (
              <Reveal key={problema.title} delay={i * 100}>
                <Card className="flex h-full flex-col p-xl">
                  <div className="mb-lg flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
                    <Icon name={problema.icon} className="text-[24px]" />
                  </div>
                  <h3 className="mb-sm font-headline-sm text-headline-sm text-on-surface">{problema.title}</h3>
                  <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">{problema.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-2xl flex w-full flex-col items-center rounded-card bg-surface-container p-lg text-center md:p-xl">
            <Icon name="autorenew" className="mb-xs text-[32px] text-secondary" />
            <p className="max-w-[42rem] font-headline-md text-headline-md text-on-surface">
              Necesitás que tu negocio trabaje para vos, no al revés. TurnCreate pone tu salón en piloto automático.
            </p>
          </div>
        </Reveal>
      </section>

      {/* BENEFICIOS */}
      <section id="beneficios" className="w-full px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-7xl">
          <div className="mb-2xl flex flex-col items-center text-center">
            <SectionEyebrow>Ventajas exclusivas</SectionEyebrow>
            <h2 className="max-w-[42rem] font-headline-xl text-headline-xl text-on-surface">
              Tu negocio en piloto automático, literal
            </h2>
            <p className="mt-xs max-w-[36rem] font-body-lg text-body-lg text-on-surface-variant">
              Diseñado con los flujos de trabajo exactos que utilizan los mejores salones de Argentina.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-12">
            {BENEFICIOS.map((b) => (
              <Card key={b.title} className={cn("flex flex-col justify-between p-xl", b.span)}>
                <div>
                  <div className="mb-md flex items-center justify-between">
                    <span className="rounded-pill bg-secondary-soft px-4 py-1.5 font-label-sm text-label-sm text-secondary">
                      {b.badge}
                    </span>
                    <Icon name={b.icon} className="text-[28px] text-secondary" />
                  </div>
                  <h3 className="mb-sm font-headline-md text-headline-md text-on-surface">{b.title}</h3>
                  <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">{b.body}</p>
                </div>
                {b.badge === "Cobro Blindado" && (
                  <div className="mt-lg space-y-sm rounded-inner bg-surface-container-low p-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-sm">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-full font-label-md text-label-md text-white"
                          style={{ backgroundColor: "#009EE3" }}
                        >
                          MP
                        </span>
                        <div>
                          <p className="font-label-md text-label-md text-on-surface">Mercado Pago</p>
                          <p className="font-body-sm text-body-sm text-status-confirmed">Conectado con 1 clic</p>
                        </div>
                      </div>
                      <Icon name="check_circle" className="text-[20px] text-status-confirmed" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1 rounded-pill bg-surface-container p-1">
                      <span className="rounded-pill px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
                        Sin seña
                      </span>
                      <span className="rounded-pill bg-primary px-3 py-1 font-label-sm text-label-sm text-on-primary">
                        % del servicio
                      </span>
                      <span className="rounded-pill px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
                        Monto fijo
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* SHOWCASE INTERACTIVO */}
      <section className="w-full px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-5xl">
          <div className="mb-2xl flex flex-col items-center text-center">
            <SectionEyebrow>Así se ve por dentro</SectionEyebrow>
            <h2 className="max-w-[42rem] font-headline-xl text-headline-xl text-on-surface">
              Todo lo que necesitás, ya construido
            </h2>
            <p className="mt-xs max-w-[36rem] font-body-lg text-body-lg text-on-surface-variant">
              Elegí una pantalla y mirá cómo se siente usar TurnCreate todos los días.
            </p>
          </div>
          <FeatureShowcase />
        </Reveal>
      </section>

      {/* VERTICALES */}
      <section id="para-quien-es" className="w-full bg-surface-container-low px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-7xl">
          <div className="mb-2xl flex flex-col items-center text-center">
            <SectionEyebrow>Verticales adaptadas</SectionEyebrow>
            <h2 className="max-w-[42rem] font-headline-xl text-headline-xl text-on-surface">¿Para quién está pensado?</h2>
            <p className="mt-xs max-w-[42rem] font-body-lg text-body-lg text-on-surface-variant">
              TurnCreate entiende cómo funciona tu rubro porque fue creado para esto.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-4">
            {VERTICALES.map((v) => (
              <Card key={v.title} className="flex flex-col justify-between p-xl">
                <div>
                  <div className="mb-md flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-xl">
                    {v.emoji}
                  </div>
                  <span className="mb-sm inline-block rounded-pill bg-surface-container-high px-3 py-0.5 font-label-sm text-label-sm text-on-surface">
                    {v.tag}
                  </span>
                  <h3 className="mb-xs font-headline-sm text-headline-sm text-on-surface">{v.title}</h3>
                  <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{v.body}</p>
                </div>
                <div className="mt-lg flex items-center gap-1 border-t border-border pt-sm font-label-sm text-label-sm text-secondary">
                  {v.footer} <span>→</span>
                </div>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="w-full px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-6xl">
          <div className="mb-2xl flex flex-col items-center text-center">
            <SectionEyebrow>Experiencia sin fricciones</SectionEyebrow>
            <h2 className="font-headline-xl text-headline-xl text-on-surface">¿Cómo funciona?</h2>
            <p className="mt-xs max-w-[36rem] font-body-lg text-body-lg text-on-surface-variant">
              El flujo mágico en 4 simples pasos para que nunca más pierdas una reserva ni un peso.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-lg md:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((paso, i) => (
              <Card key={paso.title} className="flex flex-col p-xl">
                <div
                  className={cn(
                    "mb-md flex h-10 w-10 items-center justify-center rounded-full font-headline-sm text-headline-sm",
                    i === 2 ? "bg-secondary text-on-secondary" : "bg-primary text-on-primary",
                  )}
                >
                  {i + 1}
                </div>
                <h3 className="mb-xs font-headline-sm text-headline-sm text-on-surface">{paso.title}</h3>
                <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">{paso.body}</p>
                <div className="mt-md rounded-inner bg-surface-container-low p-2 text-center font-label-sm text-label-sm text-secondary">
                  {paso.tag}
                </div>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* PLANES */}
      <section id="planes" className="w-full bg-surface-container-low px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="mx-auto max-w-6xl">
          <div className="mb-2xl flex flex-col items-center text-center">
            <SectionEyebrow>Tarifas transparentes</SectionEyebrow>
            <h2 className="font-headline-xl text-headline-xl text-on-surface">Planes que crecen con vos</h2>
            <p className="mt-xs max-w-[42rem] text-balance font-body-lg text-body-lg text-on-surface-variant">
              Pagá tu suscripción siempre en pesos, a través de Mercado Pago y sin comisiones ocultas por los turnos.
            </p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-lg lg:grid-cols-3">
            {PLANES.map((plan) => (
              <Card
                key={plan.nombre}
                className={cn(
                  "relative flex flex-col justify-between p-xl",
                  plan.featured && "ring-2 ring-secondary shadow-card-hover",
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-pill bg-secondary px-4 py-1 font-label-sm text-label-sm uppercase tracking-wider text-on-secondary shadow-card">
                    Más elegido
                  </span>
                )}
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">Plan {plan.nombre}</h3>
                  <p className="mb-lg mt-1 font-body-sm text-body-sm text-on-surface-variant">{plan.detalle}</p>
                  <div className="mb-lg">
                    <span className="font-headline-xl text-headline-xl text-on-surface">{plan.precio}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant"> ARS / mes</span>
                  </div>
                  <ul className="mb-xl flex flex-col gap-sm font-body-sm text-body-sm text-on-surface">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Icon name="check_circle" className="text-[18px] text-secondary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  href="/registro"
                  className={buttonVariants({ variant: plan.featured ? "primary" : "secondary", size: "default" })}
                >
                  {plan.cta}
                </Link>
              </Card>
            ))}
          </div>
        </Reveal>
      </section>

      {/* BANNER CTA FINAL */}
      <section className="w-full px-gutter py-2xl md:px-gutter-desktop">
        <Reveal className="relative mx-auto flex max-w-6xl flex-col items-center overflow-hidden rounded-card bg-primary p-xl text-center text-on-primary shadow-card-hover md:p-2xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[500px] -translate-x-1/2 rounded-full bg-secondary-container/30 blur-3xl" />
          <div className="relative z-10 flex flex-col items-center">
            <span className="mb-md rounded-pill bg-primary-hover px-4 py-1.5 font-label-sm text-label-sm text-secondary-soft">
              Configuración rápida en 15 minutos
            </span>
            <h2 className="mb-md max-w-3xl text-balance font-headline-xl text-headline-xl">
              No dejes para mañana los turnos que podés automatizar hoy.
            </h2>
            <p className="mb-xl max-w-[42rem] text-balance font-body-lg text-body-lg text-white/70">
              El alta de tu cuenta toma menos de 15 minutos e incluye un asistente paso a paso para dejar tu local
              configurado y listo para facturar.
            </p>
            <Link
              href="/registro"
              className="inline-flex h-14 items-center justify-center rounded-pill bg-on-primary px-2xl font-headline-sm text-headline-sm text-primary shadow-card-hover transition-all hover:-translate-y-0.5 hover:bg-surface-container-low"
            >
              Creá tu cuenta y configurá tu local hoy mismo →
            </Link>
            <div className="mt-lg flex flex-wrap items-center justify-center gap-sm font-body-sm text-body-sm text-white/70">
              <span>✓ Prueba gratuita por 7 días</span>
              <span>•</span>
              <span>✓ Asistencia humana por WhatsApp para la migración de tu agenda</span>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
