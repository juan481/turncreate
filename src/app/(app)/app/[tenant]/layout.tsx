import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { PageTransition } from "@/components/ui/page-transition";
import { ToastProvider } from "@/components/ui/toast";
import { RememberRouteSearch } from "@/components/ui/back-button";
import { planFeatures } from "@/lib/plans";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { getTenantBySlugFromFirebase, getTenantMember, getTenantMembershipsForUser } from "@/server/firebase/tenants";
import { signOut } from "./actions";
import { NavPills } from "./nav-pills";
import { MobileMenuButton } from "./mobile-menu";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { MobilePageHeader } from "./mobile-page-header";
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
  { href: "bot", label: "IA", icon: "smart_toy" },
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
  if (profile.data()?.mustChangePassword === true) redirect("/cambiar-clave");

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
  const features = planFeatures(tenant);
  const nav = NAV.filter((item) => item.href !== "staff" || (features.maxStaff > 1 && staffSnapshot.size > 1));

  return (
    <ToastProvider>
      <div className="min-h-screen bg-canvas">
        {/* Header-pill flotante: solo desktop/tablet ancho (lg+). En mobile
            lo reemplaza MobilePageHeader (sticky, violeta, con ‹Volver +
            título de la sección -- lo que pedía el rediseño) para no
            competir por los mismos ~56px de alto con dos headers a la vez. */}
        <header className="fixed inset-x-0 top-0 z-50 hidden px-gutter-desktop pt-3 lg:block">
          <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-gutter rounded-pill border border-border bg-surface-container-lowest/90 px-xl shadow-card backdrop-blur-xl">
            <div className="flex shrink-0 items-center gap-lg">
              <Link href={`/app/${tenantSlug}`} className="flex items-center gap-2">
                <Logo iconOnly className="h-8 w-auto" />
                <span className="hidden font-headline-sm text-headline-sm tracking-tight text-on-surface 2xl:inline">TurnCreate</span>
              </Link>
              <span className="hidden h-4 w-px bg-outline-variant/50 xl:block" />
              <TenantSwitcher current={currentTenantOption} options={tenantOptions.length ? tenantOptions : [currentTenantOption]} />
            </div>
            <NavPills tenantSlug={tenantSlug} items={nav} />
            <div className="flex shrink-0 items-center gap-3">
              <Link href={`/app/${tenantSlug}/ayuda`} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface" aria-label="Ayuda" title="Ayuda"><Icon name="help" className="text-[20px]" /></Link>
              <Link href={`/app/${tenantSlug}/configuracion`} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface" aria-label="Configuración" title="Configuración">
                <Icon name="settings" className="text-[20px]" />
              </Link>
              <NotificationsButton notifications={[]} />
              <div className="flex items-center gap-2 pl-1">
                <div className="hidden text-right leading-tight 2xl:block">
                  <div className="font-label-md text-label-md text-on-surface">{displayName}</div>
                  <div className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</div>
                </div>
                <Avatar name={displayName} src={avatarUrl} size="sm" ring />
              </div>
              <form action={signOut} className="hidden xl:block">
                <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface" aria-label="Cerrar sesión">
                  <Icon name="logout" className="text-[18px]" />
                </button>
              </form>
              <MobileMenuButton tenantSlug={tenantSlug} items={[...nav, { href: "configuracion", label: "Configuración", icon: "settings" }]} signOutAction={signOut} tenantOptions={tenantOptions.length ? tenantOptions : undefined} currentTenant={currentTenantOption} />
            </div>
          </div>
        </header>
        <MobilePageHeader tenantSlug={tenantSlug} tenantName={tenant.name} tenantLogoUrl={currentTenantOption.logoUrl ?? null} />
        {/* pt-5 en mobile: sin aire bajo el AppBar sticky, los botones del
            tope de cada pantalla ("Nuevo servicio", etc.) quedaban pegados
            al header. En lg+ el header-pill flotante ya reserva su lugar. */}
        <main className="mx-auto w-full max-w-[1440px] px-gutter pb-24 pt-5 lg:px-gutter-desktop lg:pb-2xl lg:pt-28">
          <PageTransition>{children}</PageTransition>
        </main>
        <Suspense fallback={null}>
          <RememberRouteSearch />
          <MobileBottomNav tenantSlug={tenantSlug} />
        </Suspense>
        <NewAppointmentFab tenantSlug={tenantSlug} />
      </div>
    </ToastProvider>
  );
}
