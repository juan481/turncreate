import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { signOut } from "./actions";

const NAV = [
  { href: "agenda", label: "Agenda" },
  { href: "clientes", label: "Clientes" },
  { href: "servicios", label: "Servicios" },
  { href: "staff", label: "Staff" },
  { href: "caja", label: "Caja" },
];

export default async function TenantAppLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  const { tenant } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-gutter">
          <div className="flex items-center gap-3">
            <Logo className="h-6 w-auto" />
            <span className="hidden h-5 w-px bg-border sm:block" />
            {/* TODO Fase 0: reemplazar por selector real de local (tenants del usuario) */}
            <span className="hidden font-label-md text-label-md text-on-surface-variant sm:inline">
              {tenant}
            </span>
          </div>

          <nav className="flex items-center gap-1 rounded-pill bg-surface-muted p-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={`/app/${tenant}/${item.href}`}
                className="rounded-pill px-4 py-1.5 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form action={signOut}>
            <button
              type="submit"
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-muted"
              aria-label="Cerrar sesión"
            >
              <Icon name="logout" className="text-[18px]" />
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-gutter py-lg">{children}</main>
    </div>
  );
}
