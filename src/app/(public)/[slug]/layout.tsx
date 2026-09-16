import { Logo } from "@/components/ui/logo";

export default async function PublicBookingLayout({
  children,
  params,
}: LayoutProps<"/[slug]">) {
  const { slug } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-gutter">
          <div className="flex flex-col leading-none">
            {/* TODO Fase 2: reemplazar por public_catalog(slug) real */}
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {slug}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Reservá tu turno
            </span>
          </div>
          <Logo className="h-6 w-auto" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-margin py-xl">
        {children}
      </main>
    </div>
  );
}
