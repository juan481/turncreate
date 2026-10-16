import { notFound } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { StatusPill } from "@/components/ui/status-pill";
import { Icon } from "@/components/ui/icon";
import { PageTransition } from "@/components/ui/page-transition";
import { ToastProvider } from "@/components/ui/toast";
import { isPlatformAdmin } from "@/server/platform";
import { PlatformNav } from "./platform-nav";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Protege la navegación; cada page.tsx repite el chequeo porque este
  // notFound() NO frena el render (ni el payload RSC) de la página.
  // notFound() en vez de redirect a /login: no hay razón para confirmarle a
  // un usuario sin permiso que esta ruta existe.
  if (!(await isPlatformAdmin())) {
    notFound();
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-canvas">
        <header className="border-b border-border bg-primary pt-[var(--safe-t)]">
          <div className="mx-auto flex h-16 w-full max-w-[80rem] min-w-0 items-center justify-between gap-3 px-gutter">
            <div className="flex min-w-0 items-center gap-3">
              <Logo className="h-6 w-auto shrink-0 [&_text]:fill-white [&_tspan]:fill-primary-glow" />
              <span className="hidden h-4 w-px bg-white/20 sm:block" />
              <span className="hidden min-w-0 items-center gap-1.5 font-label-sm text-label-sm text-white/70 sm:flex">
                <Icon name="shield_person" className="text-[16px]" />
                <span className="truncate">Consola de plataforma</span>
              </span>
            </div>
            <StatusPill status="alert" className="shrink-0">
              <span className="sm:hidden">Restringido</span>
              <span className="hidden sm:inline">Acceso restringido</span>
            </StatusPill>
          </div>
          <PlatformNav />
        </header>
        <main className="mx-auto w-full max-w-[80rem] min-w-0 flex-1 px-gutter py-lg pb-[calc(2rem+var(--safe-b))]">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </ToastProvider>
  );
}
