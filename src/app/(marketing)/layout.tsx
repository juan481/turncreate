import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { buttonVariants } from "@/components/ui/button";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-gutter">
          <Link href="/">
            <Logo className="h-7 w-auto" />
          </Link>
          <nav className="hidden items-center gap-6 font-label-md text-label-md text-on-surface-variant md:flex">
            <a href="#funciones" className="hover:text-on-surface">
              Funciones
            </a>
            <a href="#planes" className="hover:text-on-surface">
              Planes
            </a>
            <Link href="/login" className="hover:text-on-surface">
              Iniciar sesión
            </Link>
          </nav>
          <Link href="/registro" className={buttonVariants({ size: "sm" })}>
            Empezá gratis
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface px-gutter py-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 font-body-sm text-body-sm text-on-surface-variant">
          <Logo className="h-6 w-auto" />
          <p>© {new Date().getFullYear()} TurnCreate. Hecho en Argentina.</p>
        </div>
      </footer>
    </div>
  );
}
