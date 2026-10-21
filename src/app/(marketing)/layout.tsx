import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Logo } from "@/components/ui/logo";
import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";
import { MarketingMobileMenu } from "./marketing-mobile-menu";
import "./marketing.css";

const NAV = [
  { href: "#producto", label: "Producto" },
  { href: "#personalizacion", label: "Personalización" },
  { href: "#integraciones", label: "Integraciones" },
  { href: "#planes", label: "Planes" },
];

const FOOTER_COLUMNS = [
  {
    title: "Producto",
    items: ["Turnero online", "Agenda y clientes", "Señas y reembolsos", "Caja y reportes"],
  },
  {
    title: "Integraciones",
    items: ["Mercado Pago", "Transferencias", "ARCA · próximamente"],
  },
  {
    title: "Ayuda",
    items: ["Inicio guiado", "Preguntas frecuentes", "Términos y privacidad"],
  },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-gutter-desktop md:pt-4">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-3 rounded-pill border border-white/80 bg-white/78 px-3.5 shadow-[0_12px_45px_-25px_rgba(35,28,95,.4)] backdrop-blur-2xl md:h-[68px] md:px-5">
          <Link href="/landing" aria-label="TurnCreate, inicio" className="flex shrink-0 items-center gap-2 transition-transform duration-300 hover:scale-[1.02]">
            <Logo iconOnly className="h-8 w-8" />
            <span className="text-[15px] font-bold tracking-[-0.035em] text-on-surface md:text-[16px]">TurnCreate</span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-0.5 rounded-pill bg-surface-container-low/75 p-1.5 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="rounded-pill px-4 py-2 text-[11px] font-semibold text-on-surface-variant transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-on-surface hover:shadow-sm">{item.label}</a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Link href="/login" className="hidden text-[12px] font-semibold text-on-surface-variant transition-colors hover:text-primary sm:inline-flex">Iniciar sesión</Link>
            <Link href="/registro" className={cn(buttonVariants({ size: "sm" }), "hidden shadow-brand sm:inline-flex")}>Probar gratis 7 días</Link>
            <MarketingMobileMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 pt-20 md:pt-24"><PageTransition>{children}</PageTransition></main>

      <footer className="border-t border-border bg-white pb-8 pt-20">
        <div className="mx-auto max-w-[1240px] px-gutter md:px-gutter-desktop">
          <div className="grid gap-12 border-b border-border pb-14 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Link href="/landing" className="inline-flex items-center gap-2"><Logo iconOnly className="size-9" /><span className="text-[17px] font-bold tracking-[-.035em] text-on-surface">TurnCreate</span></Link>
              <p className="mt-5 max-w-[24rem] text-[13px] leading-6 text-on-surface-variant">El sistema de turnos, señas, clientes y caja para negocios de servicios en Argentina.</p>
              <span className="mt-6 inline-flex items-center gap-2 rounded-pill bg-secondary-soft px-3 py-2 text-[11px] font-semibold text-primary"><Icon name="location_on" className="text-[14px]" /> Creado en Argentina</span>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="text-[11px] font-bold uppercase tracking-[.14em] text-on-surface">{column.title}</h2>
                <ul className="mt-5 space-y-3.5">{column.items.map((item) => <li key={item} className="text-[12px] text-on-surface-variant">{item}</li>)}</ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 pt-7 text-[11px] text-on-surface-variant sm:flex-row">
            <p>© {new Date().getFullYear()} TurnCreate · Todos los derechos reservados.</p>
            <a href="https://justcreate.com.ar" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 transition-colors hover:text-primary">Desarrollado por <strong className="font-semibold text-on-surface">Just Create</strong><Icon name="north_east" className="text-[13px]" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
