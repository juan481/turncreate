import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";

const NAV = [
  { href: "#beneficios", label: "Beneficios" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#para-quien-es", label: "Para quién es" },
  { href: "#planes", label: "Planes" },
];

const FOOTER_COLUMNS = [
  {
    title: "Producto",
    items: ["Turnero Online", "Señas Mercado Pago", "Recordatorios WhatsApp", "Arqueo de Caja", "Comisiones Staff"],
  },
  {
    title: "Rubros",
    items: ["Estética & Cosmiatría", "Barberías & Peluquerías", "Salones de Uñas", "Spas & Masajes"],
  },
  {
    title: "Recursos & Ayuda",
    items: ["Soporte WhatsApp Oficial", "Guía de Inicio Rápido", "Términos y Privacidad", "Integración AFIP & MP"],
  },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 px-gutter pt-3 md:px-gutter-desktop">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-gutter rounded-pill border border-border bg-surface-container-lowest/85 px-4 shadow-card backdrop-blur-xl md:h-[72px] md:px-xl">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Logo iconOnly className="h-8 w-auto" />
            <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">
              TurnCreate
            </span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-pill border border-outline-variant/30 bg-surface-container-low/70 p-1.5 lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-pill px-4 py-1.5 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface hover:bg-surface-container-lowest"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/login"
              className="hidden font-label-lg text-label-lg text-on-surface-variant transition-colors hover:text-on-surface sm:inline-flex"
            >
              Iniciar sesión
            </Link>
            <Link href="/registro" className={buttonVariants({ size: "sm" })}>
              Empezá gratis
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 pt-24 md:pt-28">
        <PageTransition>{children}</PageTransition>
      </main>
      <footer className="w-full border-t border-border bg-surface-container-lowest pb-xl pt-2xl">
        <div className="mx-auto w-full max-w-[1440px] px-gutter md:px-gutter-desktop">
          <div className="grid grid-cols-1 gap-xl border-b border-border pb-2xl md:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-md pr-xl lg:col-span-2">
              <div className="flex items-center gap-2">
                <Logo iconOnly className="h-8 w-auto" />
                <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">TurnCreate</span>
              </div>
              <p className="max-w-[24rem] font-body-md text-body-md leading-relaxed text-on-surface-variant">
                Gestión inteligente, señas automáticas y control total para salones en Argentina.
              </p>
              <div className="flex flex-wrap items-center gap-sm pt-xs">
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> Servidores en Buenos Aires
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed-dot" /> 99.9% Uptime
                </span>
              </div>
            </div>
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-sm">
                <h4 className="mb-xs font-label-lg text-label-lg uppercase tracking-wider text-on-surface">
                  {col.title}
                </h4>
                <ul className="flex flex-col gap-sm">
                  {col.items.map((item) => (
                    <li
                      key={item}
                      className="cursor-pointer font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-md pt-lg text-on-surface-variant md:flex-row">
            <p className="text-center font-body-sm text-body-sm md:text-left">
              © {new Date().getFullYear()} TurnCreate Argentina · Pagos procesados de forma segura con Mercado Pago
            </p>
            <div className="flex items-center gap-md">
              <span className="rounded-pill bg-surface-container px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
                AR ARS
              </span>
              <span className="rounded-pill bg-surface-container px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
                Español (Argentina)
              </span>
            </div>
          </div>
          <div className="mt-lg flex justify-center border-t border-border pt-lg md:justify-start">
            <a
              href="https://justcreate.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:text-secondary"
            >
              Tecnología desarrollada por
              <span className="font-label-md text-label-md text-on-surface">Just Create</span>
              <Icon name="north_east" className="text-[14px]" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
