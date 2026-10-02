import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { PageTransition } from "@/components/ui/page-transition";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { getTenantBySlugFromFirebase, getTenantMember, getTenantMembershipsForUser } from "@/server/firebase/tenants";
import { signOut } from "./actions";
import { NavPills } from "./nav-pills";
import { MobileMenuButton } from "./mobile-menu";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { NewAppointmentFab } from "./new-appointment-fab";
import { NotificationsButton } from "./notifications-button";
import { TenantSwitcher, type TenantOption } from "./tenant-switcher";

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
  owner: "Propietario/a",
  admin: "Administrador/a",
  receptionist: "Recepción",
  professional: "Profesional",
};

export default async function TenantAppLayout({
  children,
  params,
}: LayoutProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const [tenant, user] = await Promise.all([
    getTenantBySlugFromFirebase(tenantSlug),
    getCurrentFirebaseUser(),
  ]);
  if (!tenant) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/${tenantSlug}`)}`);

  const [member, tenantOptions, profile, staffSnapshot] = await Promise.all([
    getTenantMember(user.uid, tenant.id),
    getTenantMembershipsForUser(user.uid),
    firebaseAdmin().db.collection("users").doc(user.uid).get(),
    firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
  ]);
  if (!member || member.status !== "active") notFound();

  const currentTenantOption: TenantOption = {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    role: typeof member.role === "string" ? member.role : "professional",
    logoUrl: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null,
  };
  const displayName = (profile.data()?.fullName as string | undefined) || user.name || user.email || "Usuario";
  const avatarUrl = (profile.data()?.avatarUrl as string | undefined) ?? null;
  const roleLabel = ROLE_LABEL[currentTenantOption.role] ?? currentTenantOption.role;
  const nav = NAV.filter((item) => item.href !== "staff" || staffSnapshot.size > 1);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="fixed inset-x-0 top-0 z-50 px-gutter pt-3 md:px-gutter-desktop">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-gutter rounded-pill border border-border bg-surface-container-lowest/90 px-4 shadow-card backdrop-blur-xl md:h-[72px] md:px-xl">
          <div className="flex shrink-0 items-center gap-lg">
            <Link href={`/app/${tenantSlug}`} className="flex items-center gap-2">
              <Logo iconOnly className="h-8 w-auto" />
              <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface">TurnCreate</span>
            </Link>
            <span className="hidden h-4 w-px bg-outline-variant/50 xl:block" />
            <TenantSwitcher current={currentTenantOption} options={tenantOptions.length ? tenantOptions : [currentTenantOption]} />
          </div>
          <NavPills tenantSlug={tenantSlug} items={nav} />
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <Link href={`/app/${tenantSlug}/configuracion`} className="hidden h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface sm:flex" aria-label="Configuración" title="Configuración">
              <Icon name="settings" className="text-[20px]" />
            </Link>
            <NotificationsButton notifications={[]} />
            <div className="hidden items-center gap-2 pl-1 sm:flex">
              <div className="text-right leading-tight">
                <div className="font-label-md text-label-md text-on-surface">{displayName}</div>
                <div className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</div>
              </div>
              <Avatar name={displayName} src={avatarUrl} size="sm" ring />
            </div>
            <form action={signOut} className="hidden lg:block">
              <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface" aria-label="Cerrar sesión">
                <Icon name="logout" className="text-[18px]" />
              </button>
            </form>
            <MobileMenuButton tenantSlug={tenantSlug} items={[...nav, { href: "configuracion", label: "Configuración", icon: "settings" }]} signOutAction={signOut} tenantOptions={tenantOptions.length ? tenantOptions : undefined} currentTenant={currentTenantOption} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-gutter pb-28 pt-24 md:px-gutter-desktop md:pb-2xl md:pt-28"><PageTransition>{children}</PageTransition></main>
      <MobileBottomNav tenantSlug={tenantSlug} />
      <NewAppointmentFab tenantSlug={tenantSlug} />
    </div>
  );
}
