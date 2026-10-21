import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import { Reveal } from "@/components/ui/reveal";
import { DEFAULT_PLAN_PRICES_ARS, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { BookingJourney, BrandColorShowcase } from "./marketing-product-showcase";

const PLANS = [
  {
    id: "solo" as PlanId,
    name: "Individual",
    detail: "Para quien trabaja de forma independiente.",
    price: DEFAULT_PLAN_PRICES_ARS.solo,
    limit: "1 profesional",
    features: ["Agenda y turnero online", "Clientes e historial", "Señas con Mercado Pago", "Reportes esenciales"],
    featured: false,
  },
  {
    id: "equipo" as PlanId,
    name: "Estudio",
    detail: "Para estudios y equipos pequeños.",
    price: DEFAULT_PLAN_PRICES_ARS.equipo,
    limit: "Hasta 5 profesionales",
    features: ["Todo lo del plan Individual", "Agenda por profesional", "Apertura y cierre de caja", "Reportes y administración"],
    featured: true,
  },
  {
    id: "pro" as PlanId,
    name: "Equipo",
    detail: "Para operaciones en crecimiento.",
    price: DEFAULT_PLAN_PRICES_ARS.pro,
    limit: "Hasta 15 profesionales",
    features: ["Todo lo del plan Estudio", "Mayor capacidad de equipo", "Control de caja", "Beta de facturación ARCA próximamente"],
    featured: false,
  },
] as const;

const formatPlanPrice = (price: number) => `$${price.toLocaleString("es-AR")}`;

const AGENDA = [
  { time: "09:30", name: "Lucía", service: "Corte clásico", color: "bg-[#e9e5ff] text-[#5146be]", span: "md:col-start-1" },
  { time: "10:00", name: "Mateo", service: "Limpieza facial", color: "bg-[#f2dcff] text-[#7b3fa2]", span: "md:col-start-2" },
  { time: "11:30", name: "Carla", service: "Manicura", color: "bg-[#ffe4ec] text-[#9b3f60]", span: "md:col-start-3" },
  { time: "13:00", name: "Valentina", service: "Color + brushing", color: "bg-[#e3ecff] text-[#35579b]", span: "md:col-start-1" },
  { time: "14:30", name: "Nicolás", service: "Barba", color: "bg-[#e3f8ee] text-[#247452]", span: "md:col-start-2" },
  { time: "16:00", name: "Andrea", service: "Diseño de uñas", color: "bg-[#fff0d8] text-[#8b5a11]", span: "md:col-start-3" },
] as const;

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <span className={cn("mb-5 inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em]", dark ? "bg-white/10 text-white/80" : "bg-secondary-soft text-primary")}>
      <span className={cn("size-1.5 rounded-full", dark ? "bg-primary-light" : "bg-primary")} />
      {children}
    </span>
  );
}

function HeroBookingPhone() {
  return (
    <div className="hero-phone relative z-20 w-[178px] shrink-0 rounded-[2rem] border-[5px] border-white bg-surface p-3 shadow-[0_30px_70px_-22px_rgba(52,45,140,.45)] sm:w-[205px]">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-pill bg-on-surface/10" />
      <div className="flex items-center gap-1.5"><span className="flex size-5 items-center justify-center rounded-[6px] bg-primary text-on-primary"><Icon name="auto_awesome" className="text-[10px]" /></span><span className="text-[8px] font-bold">TurnCreate</span></div>
      <div className="mt-3 grid grid-cols-5 gap-1"><span className="h-1 rounded-pill bg-primary" /><span className="h-1 rounded-pill bg-primary/20" /><span className="h-1 rounded-pill bg-primary/20" /><span className="h-1 rounded-pill bg-primary/20" /><span className="h-1 rounded-pill bg-primary/20" /></div>
      <p className="mt-4 text-[8px] font-semibold uppercase tracking-[.12em] text-primary">Reservá tu turno</p>
      <h3 className="mt-1 text-[14px] font-semibold tracking-[-.03em] text-on-surface">Elegí un servicio</h3>
      <div className="mt-3 space-y-1.5">
        {["Corte de pelo", "Corte + barba", "Limpieza facial"].map((service, index) => (
          <div key={service} className={cn("flex h-10 items-center gap-2 rounded-[10px] border px-2", index === 0 ? "border-primary bg-secondary-soft" : "border-border")}>
            <span className={cn("size-3 rounded-full border", index === 0 ? "border-primary bg-primary" : "border-outline-variant")} />
            <span className="min-w-0 flex-1 text-[7px] font-semibold text-on-surface">{service}</span>
            <span className="text-[7px] font-bold text-on-surface">${index === 0 ? "18" : index === 1 ? "26" : "30"}k</span>
          </div>
        ))}
      </div>
      <span className="mt-3 flex h-8 items-center justify-center rounded-pill bg-primary text-[8px] font-bold text-on-primary shadow-brand">Continuar →</span>
    </div>
  );
}

function DashboardPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("marketing-dashboard overflow-hidden rounded-[1.6rem] border border-white/90 bg-white/92 shadow-[0_34px_100px_-38px_rgba(47,40,125,.34)] backdrop-blur-xl", compact ? "min-w-[630px]" : "w-full")}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-[9px] bg-primary text-on-primary"><Icon name="auto_awesome" className="text-[13px]" /></span><span className="text-[11px] font-bold text-on-surface">TurnCreate</span></div>
        <div className="flex items-center gap-3"><span className="hidden text-[9px] font-semibold text-on-surface-variant sm:inline">Studio Lumen</span><Avatar name="Sofía Lumen" size="sm" /></div>
      </div>
      <div className="grid grid-cols-[108px_1fr]">
        <aside className="border-r border-border bg-surface-container-lowest p-3">
          {[{ i: "home", t: "Inicio" }, { i: "calendar_month", t: "Agenda" }, { i: "group", t: "Clientes" }, { i: "payments", t: "Pagos y caja" }, { i: "monitoring", t: "Reportes" }].map((item, index) => (
            <div key={item.t} className={cn("mb-1 flex h-8 items-center gap-2 rounded-lg px-2 text-[8px] font-semibold", index === 1 ? "bg-secondary-soft text-primary" : "text-on-surface-variant")}><Icon name={item.i} className="text-[12px]" />{item.t}</div>
          ))}
        </aside>
        <div className="min-w-0 p-4">
          <div className="flex items-center justify-between"><div><h3 className="text-[16px] font-semibold tracking-[-.03em] text-on-surface">Agenda</h3><p className="text-[8px] text-on-surface-variant">Jueves 22 de octubre de 2026</p></div><span className="rounded-pill bg-secondary-soft px-3 py-1.5 text-[8px] font-bold text-primary">Hoy</span></div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {AGENDA.map((appointment) => (
              <div key={`${appointment.time}-${appointment.name}`} className={cn("min-h-14 rounded-xl p-2 transition-transform duration-300 hover:-translate-y-1", appointment.color, appointment.span)}>
                <p className="text-[7px] font-bold opacity-75">{appointment.time}</p><p className="mt-0.5 text-[8px] font-bold">{appointment.service}</p><p className="text-[7px] opacity-80">{appointment.name}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[['Turnos', '24'], ['Señas cobradas', '$134.000'], ['Asistencia', '96%']].map(([label, value]) => <div key={label} className="rounded-xl bg-surface-container-low p-2"><p className="text-[7px] text-on-surface-variant">{label}</p><p className="mt-0.5 text-[11px] font-bold text-on-surface">{value}</p></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroProductStage() {
  return (
    <div className="product-stage relative mt-12 min-h-[430px] w-full overflow-hidden rounded-[2.5rem] border border-white/75 p-5 sm:min-h-[500px] sm:p-10 lg:mt-0 lg:min-h-[610px] lg:p-10">
      <Image src="/marketing/turncreate-light-waves.webp" alt="" fill priority sizes="(max-width: 768px) 100vw, 1200px" className="object-cover opacity-95" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,.92),transparent_54%)]" />
      <div className="relative mx-auto flex h-full max-w-[1050px] items-center justify-center pt-10 sm:pt-16">
        <div className="hero-dashboard w-[91%] max-w-[850px] translate-x-[5%] rotate-[.4deg]"><DashboardPreview compact /></div>
        <div className="absolute bottom-4 left-[3%] sm:bottom-1 sm:left-[8%] lg:left-[4%]"><HeroBookingPhone /></div>
        <div className="marketing-float absolute right-[2%] top-[4%] hidden items-center gap-2 rounded-pill border border-white/80 bg-white/80 px-4 py-2 text-[10px] font-semibold text-on-surface shadow-card backdrop-blur-md md:flex"><Icon name="payments" className="text-[14px] text-status-confirmed" /> Seña recibida · $18.000</div>
        <div className="marketing-float-delayed absolute bottom-[8%] right-[1%] hidden items-center gap-2 rounded-pill border border-white/80 bg-white/80 px-4 py-2 text-[10px] font-semibold text-on-surface shadow-card backdrop-blur-md lg:flex"><Icon name="check_circle" className="text-[14px] text-status-confirmed" /> Turno confirmado</div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="group flex gap-4 rounded-[1.2rem] p-3 transition-all duration-300 hover:translate-x-1 hover:bg-surface">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-primary transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"><Icon name={icon} className="text-[19px]" /></span>
      <div><h3 className="text-[14px] font-semibold text-on-surface">{title}</h3><p className="mt-1 text-[12px] leading-relaxed text-on-surface-variant">{body}</p></div>
    </div>
  );
}

export default function MarketingHomePage() {
  return (
    <div className="landing-shell w-full overflow-hidden">
      <section className="relative px-gutter pb-24 pt-16 md:px-gutter-desktop md:pb-36 md:pt-24">
        <div aria-hidden="true" className="absolute left-1/2 top-0 -z-10 h-[620px] w-[1100px] max-w-[130vw] -translate-x-1/2 rounded-full bg-primary-glow/20 blur-[100px]" />
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 text-center lg:grid-cols-[0.76fr_1.24fr] lg:gap-5 lg:text-left">
          <div className="relative z-10 lg:pr-5">
            <div className="animate-fade-up"><Eyebrow>Turnos, señas y gestión en un solo lugar</Eyebrow></div>
            <h1 className="mx-auto max-w-[870px] animate-fade-up text-balance text-[3.1rem] font-semibold leading-[.98] tracking-[-.055em] text-on-surface sm:text-[4.5rem] lg:mx-0 lg:text-[4.6rem]" style={{ animationDelay: "80ms" }}>
              Tu negocio, <span className="marketing-gradient-text">siempre en orden.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-[670px] animate-fade-up text-balance text-[16px] leading-7 text-on-surface-variant md:text-[18px] md:leading-8 lg:mx-0" style={{ animationDelay: "150ms" }}>
              TurnCreate une reservas, clientes, señas y caja para barberías, salones y centros de estética. Tus clientes reservan solos y vos recuperás el control del día.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start" style={{ animationDelay: "220ms" }}>
              <Link href="/registro" className={cn(buttonVariants(), "group h-13 w-full px-7 shadow-brand sm:w-auto")}>
                Probalo gratis 7 días <Icon name="arrow_forward" className="text-[16px] transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#producto" className={cn(buttonVariants({ variant: "secondary" }), "group h-13 w-full px-7 sm:w-auto")}><Icon name="play_circle" className="text-[18px] text-primary transition-transform group-hover:scale-110" /> Ver el producto</a>
            </div>
            <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] font-medium text-on-surface-variant lg:justify-start" style={{ animationDelay: "280ms" }}>
              <span className="flex items-center gap-1.5"><Icon name="check_circle" className="text-[14px] text-primary" /> Sin tarjeta</span>
              <span className="flex items-center gap-1.5"><Icon name="bolt" className="text-[14px] text-primary" /> Configuración guiada</span>
              <span className="flex items-center gap-1.5"><Icon name="shield_person" className="text-[14px] text-primary" /> Sin permanencia</span>
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: "340ms" }}><HeroProductStage /></div>
        </div>
      </section>

      <section id="producto" className="landing-section bg-surface-container-low/55">
        <Reveal className="mx-auto max-w-[1240px]">
          <div className="mb-14 max-w-[680px] md:mb-20">
            <Eyebrow>Reserva online</Eyebrow>
            <h2 className="text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-.045em] text-on-surface md:text-[3.6rem]">Tus clientes reservan en minutos, sin vueltas.</h2>
            <p className="mt-6 max-w-[590px] text-[15px] leading-7 text-on-surface-variant md:text-[17px]">Un flujo claro desde el servicio hasta el pago. Probá cada paso: fechas visibles, horarios amplios, datos mínimos y una política de seña que se entiende.</p>
          </div>
          <BookingJourney />
        </Reveal>
      </section>

      <section className="landing-section">
        <Reveal className="mx-auto grid max-w-[1240px] items-center gap-16 lg:grid-cols-[0.68fr_1.32fr] lg:gap-20">
          <div>
            <Eyebrow>Todo en un solo lugar</Eyebrow>
            <h2 className="text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-.045em] text-on-surface md:text-[3.35rem]">Gestioná tu negocio desde un panel completo.</h2>
            <p className="mt-6 text-[15px] leading-7 text-on-surface-variant">Agenda, clientes, pagos, caja y reportes se conectan para que veas qué está pasando sin saltar entre planillas.</p>
            <div className="mt-9 space-y-1">
              <FeatureRow icon="calendar_month" title="Agenda en tiempo real" body="Turnos ordenados por horario y profesional." />
              <FeatureRow icon="group" title="Clientes" body="Historial, notas y próximas visitas en contexto." />
              <FeatureRow icon="payments" title="Pagos y caja" body="Señas, cobros y movimientos del día." />
              <FeatureRow icon="monitoring" title="Reportes" body="Información clara para decidir mejor." />
            </div>
          </div>
          <div className="relative min-w-0">
            <div aria-hidden="true" className="absolute inset-10 -z-10 rounded-full bg-primary-glow/30 blur-3xl" />
            <div className="overflow-x-auto rounded-[2rem] bg-surface-container-low p-4 shadow-card [scrollbar-width:none] md:p-7"><DashboardPreview compact /></div>
          </div>
        </Reveal>
      </section>

      <section id="personalizacion" className="landing-section bg-[linear-gradient(180deg,rgba(245,242,255,.25),rgba(245,242,255,.85),rgba(255,255,255,1))]">
        <Reveal className="mx-auto max-w-[1240px]">
          <div className="mb-14 max-w-[700px] md:mb-20">
            <Eyebrow>Tu marca, tu color</Eyebrow>
            <h2 className="text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-.045em] text-on-surface md:text-[3.45rem]">Una experiencia que se siente propia.</h2>
            <p className="mt-6 max-w-[620px] text-[15px] leading-7 text-on-surface-variant md:text-[17px]">Personalizá el color del turnero desde Configuración. Cada interacción conserva el diseño premium de TurnCreate con la identidad de tu negocio.</p>
          </div>
          <BrandColorShowcase />
        </Reveal>
      </section>

      <section id="integraciones" className="landing-section">
        <Reveal className="mx-auto max-w-[1240px]">
          <div className="grid items-end gap-10 lg:grid-cols-[0.65fr_1.35fr]">
            <div>
              <Eyebrow>Integraciones</Eyebrow>
              <h2 className="text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-.045em] text-on-surface md:text-[3.35rem]">Todo conectado para que vendas más.</h2>
              <p className="mt-6 text-[15px] leading-7 text-on-surface-variant">Cobrá con las herramientas que ya usás y preparate para la facturación electrónica.</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="marketing-integration-card group rounded-card border border-border bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover">
                <div className="flex items-center gap-4"><span className="flex h-14 w-24 items-center justify-center rounded-inner bg-white px-2 shadow-sm"><MercadoPagoLogo className="text-[30px]" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-semibold text-on-surface">Mercado Pago</h3><span className="rounded-pill bg-status-confirmed-bg px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-status-confirmed">Disponible</span></div><p className="mt-1 text-[12px] text-on-surface-variant">Ecosistema Mercado Libre</p></div></div>
                <p className="mt-5 text-[13px] leading-6 text-on-surface-variant">Cobrá señas online. El pago se acredita en la cuenta conectada del comercio.</p>
              </div>
              <div className="marketing-integration-card group rounded-card border border-border bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover">
                <div className="flex items-center gap-4"><span className="flex size-14 items-center justify-center overflow-hidden rounded-inner bg-white p-1 shadow-sm"><Image src="/brands/arca.jpeg" alt="ARCA" width={56} height={56} unoptimized className="h-full w-full object-contain" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-semibold text-on-surface">Facturación ARCA</h3><span className="rounded-pill bg-secondary-soft px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-primary">Próximamente · beta</span></div><p className="mt-1 text-[12px] text-on-surface-variant">Prevista para el plan Equipo</p></div></div>
                <p className="mt-5 text-[13px] leading-6 text-on-surface-variant">Estamos preparando comprobantes electrónicos desde TurnCreate. La landing lo comunica como hoja de ruta, no como función activa.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="planes" className="landing-section bg-surface-container-low/55">
        <Reveal className="mx-auto max-w-[1180px]">
          <div className="mx-auto mb-14 max-w-[680px] text-center md:mb-20">
            <Eyebrow>Planes claros</Eyebrow>
            <h2 className="text-balance text-[2.35rem] font-semibold leading-[1.04] tracking-[-.045em] text-on-surface md:text-[3.45rem]">Un plan para cada etapa.</h2>
            <p className="mt-6 text-[15px] leading-7 text-on-surface-variant md:text-[17px]">Todos incluyen agenda, clientes, turnero y cobro de señas. Cambia la capacidad operativa de tu equipo.</p>
          </div>
          <div className="marketing-plan-grid grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article key={plan.name} className={cn("group relative flex min-h-[470px] flex-col rounded-[2rem] border bg-surface p-7 shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover md:p-8", plan.featured ? "border-primary ring-2 ring-primary/10" : "border-border")}>
                {plan.featured && <span className="absolute inset-x-5 -top-3 flex h-7 items-center justify-center rounded-pill bg-primary text-[10px] font-bold uppercase tracking-[.14em] text-on-primary shadow-brand">Más elegido</span>}
                <div className="flex items-start justify-between gap-3"><div><h3 className="text-[22px] font-semibold tracking-[-.03em] text-on-surface">{plan.name}</h3><p className="mt-1 text-[12px] font-semibold text-primary">{plan.limit}</p></div><span className="flex size-10 items-center justify-center rounded-full bg-secondary-soft text-primary transition-transform duration-300 group-hover:scale-110"><Icon name={plan.name === "Individual" ? "person" : "group"} className="text-[19px]" /></span></div>
                <p className="mt-5 min-h-10 text-[13px] leading-5 text-on-surface-variant">{plan.detail}</p>
                <div className="mt-6"><span className="text-[34px] font-semibold tracking-[-.04em] text-on-surface">{formatPlanPrice(plan.price)}</span><span className="ml-1 text-[11px] text-on-surface-variant">ARS / mes</span></div>
                <Link href="/registro" className={cn(buttonVariants({ variant: plan.featured ? "primary" : "secondary" }), "mt-6 w-full")}>Probalo gratis 7 días</Link>
                <ul className="mt-7 space-y-3">
                  {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2.5 text-[12px] leading-5 text-on-surface-variant"><Icon name="check_circle" className="mt-0.5 text-[15px] text-primary" />{feature}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center text-[11px] text-on-surface-variant">Precios mensuales en pesos argentinos. Consultá las condiciones vigentes al contratar.</p>
        </Reveal>
      </section>

      <section className="px-gutter pb-16 pt-24 md:px-gutter-desktop md:pb-24 md:pt-36">
        <Reveal className="relative mx-auto max-w-[1240px] overflow-hidden rounded-[2.5rem] bg-[#17143f] px-6 py-20 text-center text-white shadow-[0_36px_100px_-34px_rgba(35,28,118,.65)] md:px-12 md:py-28">
          <Image src="/marketing/turncreate-dark-waves.webp" alt="" fill sizes="1200px" className="object-cover opacity-70" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(123,97,255,.25),transparent_55%)]" />
          <div className="relative z-10 mx-auto max-w-[760px]">
            <Eyebrow dark>Empezá hoy</Eyebrow>
            <h2 className="text-balance text-[2.4rem] font-semibold leading-[1.02] tracking-[-.045em] md:text-[4rem]">Llevá tu negocio al próximo nivel.</h2>
            <p className="mx-auto mt-6 max-w-[610px] text-[15px] leading-7 text-white/65">Probá TurnCreate durante 7 días. Explorá el turnero, tu panel y la personalización antes de elegir un plan.</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href="/registro" className={cn(buttonVariants(), "group h-13 w-full bg-white px-7 text-[#28205e] hover:bg-white/90 sm:w-auto")}>Probalo gratis 7 días <Icon name="arrow_forward" className="text-[16px] transition-transform group-hover:translate-x-1" /></Link><a href="#producto" className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-pill border border-white/20 bg-white/5 px-7 text-[12px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-white/10 sm:w-auto"><Icon name="play_circle" className="text-[17px]" /> Ver el producto</a></div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
