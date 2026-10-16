import { Logo } from "@/components/ui/logo";
import { JustCreateFooter } from "@/components/ui/just-create-footer";
import { getPublicTenant } from "./actions";
import { notFound } from "next/navigation";
import Image from "next/image";

export default async function PublicBookingLayout({
  children,
  params,
}: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  
  if (!tenant) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-gutter">
          <div className="flex min-w-0 flex-col leading-none">
            <span className="truncate font-headline-sm text-headline-sm text-on-surface">
              {tenant.name}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              Reservá tu turno
            </span>
          </div>
          {tenant.logo_url ? (
            <Image src={tenant.logo_url} alt={tenant.name} width={96} height={32} unoptimized className="h-8 w-auto max-w-[6rem] shrink-0 object-contain" />
          ) : (
            <Logo className="h-6 w-auto shrink-0" />
          )}
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-[32rem] flex-1 px-margin py-xl">
        {children}
      </main>
      <JustCreateFooter />
    </div>
  );
}
