import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { PageTransition } from "@/components/ui/page-transition";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { getRecentNotifications } from "@/server/notifications";
import { signOut } from "./actions";
import { NavPills } from "./nav-pills";
import { MobileMenuButton } from "./mobile-menu";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { NewAppointmentFab } from "./new-appointment-fab";
import { NotificationsButton } from "./notifications-button";

const NAV = [
  { href: "", label: "Inicio", icon: "home" },
  { href: "agenda", label: "Agenda", icon: "calendar_month" },
  { href: "clientes", label: "Clientes", icon: "group" },
  { href: "servicios", label: "Servicios", icon: "content_cut" },
  { href: "staff", label: "Staff", icon: "badge" },
  { href: "caja", label: "Caja", icon: "point_of_sale" },
  { href: "reportes", label: "Reportes", icon: "monitoring" },
];

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador/a",
  receptionist: "Recepción",
  professional: "Profesional",
};

export default async function TenantAppLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [{ data: { user } }, staffCountRes, notifications] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("active", true),
    getRecentNotifications(supabase, tenant.id),
  ]);
  // Con un solo profesional (el dueño), gestionar "staff" no aporta nada
  // -- se accede desde Configuración si algún día suma a alguien más.
  const hasMultipleStaff = (staffCountRes.count ?? 0) > 1;
  const nav = NAV.filter((item) => item.href !== "staff" || hasMultipleStaff);

  let displayName = user?.email ?? "Usuario";
  let roleLabel = "";
  let avatarUrl: string | null = null;

  if (user) {
    const [{ data: member }, { data: profile }] = await Promise.all([
      supabase
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenant.id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (member) roleLabel = ROLE_LABEL[member.role] ?? member.role;
    if (profile) {
      displayName = profile.full_name || displayName;
      avatarUrl = profile.avatar_url;
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 px-gutter pt-3 md:px-gutter-desktop">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-gutter rounded-pill border border-border bg-surface-container-lowest/90 px-4 shadow-card backdrop-blur-xl md:h-[72px] md:px-xl">
          <div className="flex shrink-0 items-center gap-lg">
            <Link href={`/app/${tenantSlug}`} className="flex items-center gap-2">
              <Logo iconOnly className="h-8 w-auto" />
              <span className="hidden font-headline-sm text-headline-sm tracking-tight text-on-surface sm:inline">
                TurnCreate
              </span>
            </Link>
            <span className="hidden h-4 w-px bg-outline-variant/50 xl:block" />
            <div className="hidden items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant xl:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed-dot" />
              {tenant.name}
            </div>
          </div>

          <NavPills tenantSlug={tenantSlug} items={nav} />

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Link
              href={`/app/${tenantSlug}/configuracion`}
              className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:flex"
              aria-label="Configuración"
              title="Configuración"
            >
              <Icon name="settings" className="text-[20px]" />
            </Link>
            <NotificationsButton notifications={notifications} />
            <div className="hidden items-center gap-2 pl-1 sm:flex">
              <div className="text-right leading-tight">
                <div className="font-label-md text-label-md text-on-surface">{displayName}</div>
                {roleLabel && (
                  <div className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</div>
                )}
              </div>
              <Avatar name={displayName} src={avatarUrl} size="sm" ring />
            </div>
            <form action={signOut} className="hidden lg:block">
              <button
                type="submit"
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
                aria-label="Cerrar sesión"
              >
                <Icon name="logout" className="text-[18px]" />
              </button>
            </form>
            <MobileMenuButton
              tenantSlug={tenantSlug}
              items={[...nav, { href: "configuracion", label: "Configuración", icon: "settings" }]}
              signOutAction={signOut}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-gutter pb-28 pt-24 md:px-gutter-desktop md:pb-2xl md:pt-28">
        <PageTransition>{children}</PageTransition>
      </main>
      <MobileBottomNav tenantSlug={tenantSlug} />
      <NewAppointmentFab tenantSlug={tenantSlug} />
    </div>
  );
}
