import { Logo } from "@/components/ui/logo";
import { JustCreateFooter } from "@/components/ui/just-create-footer";
import { getPublicTenant } from "./actions";
import { notFound } from "next/navigation";
import Image from "next/image";
import { brandThemeStyle } from "@/lib/brand-theme";

function instagramDetails(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const handle = url.pathname.split("/").filter(Boolean)[0];
    return { href: url.toString(), label: handle ? `@${handle.replace(/^@/, "")}` : "Instagram" };
  } catch {
    return null;
  }
}

export default async function PublicBookingLayout({
  children,
  params,
}: LayoutProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  const instagram = instagramDetails(tenant?.instagram_url ?? null);
  
  if (!tenant) {
    notFound();
  }

  return (
    <div style={brandThemeStyle(tenant.brand_color)} className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex min-h-16 items-center justify-between gap-3 px-gutter py-2.5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-headline-sm text-headline-sm text-on-surface">
              {tenant.name}
            </span>
            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 font-label-sm text-label-sm text-on-surface-variant">
              {tenant.address && <span className="flex min-w-0 items-center gap-1"><span aria-hidden>📍</span><span className="truncate">{tenant.address}</span></span>}
              {instagram && <a href={instagram.href} target="_blank" rel="noopener noreferrer" className="shrink-0 text-secondary hover:underline">{instagram.label}</a>}
            </div>
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
