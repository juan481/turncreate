import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getMpConnection } from "@/server/mercadopago/connections";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { BusinessInfoForm } from "./business-info-form";
import { PublicLink } from "../public-link";
import { BusinessHoursForm } from "./business-hours-form";
import { DepositSettingsForm } from "./deposit-settings-form";
import { MercadoPagoSettings } from "./mercadopago-settings";

function SectionCard({ icon, title, description, children }: { icon: string; title: string; description: string; children: React.ReactNode }) {
  return <Card hoverLift={false} className="space-y-md p-xl">
    <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-soft text-secondary"><Icon name={icon} className="text-[18px]" /></span><div><h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2><p className="font-body-sm text-body-sm text-on-surface-variant">{description}</p></div></div>
    {children}
  </Card>;
}

export default async function ConfiguracionPage({ params }: PageProps<"/app/[tenant]/configuracion">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;
  const [staffSnapshot, mpConnection] = await Promise.all([
    firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get(),
    getMpConnection(tenant.id),
  ]);
  const staffCount = staffSnapshot.size;
  const mpConnected = mpConnection?.status === "connected";

  return <div className="mx-auto max-w-[42rem] space-y-lg">
    <div className="hidden lg:block"><h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Configuración</h1><p className="font-body-sm text-body-sm text-on-surface-variant">Datos del local, horarios, señas e integraciones.</p></div>
    <p className="font-body-sm text-body-sm text-on-surface-variant lg:hidden">Datos del local, horarios, señas e integraciones.</p>

    <SectionCard icon="storefront" title="Datos del negocio" description="Lo que ve la clienta en tu turnero público.">
      <PublicLink url={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://turn.justcreate.com.ar"}/${tenantSlug}`} />
      <BusinessInfoForm tenantSlug={tenantSlug} tenant={{ name: tenant.name, address: (tenant as typeof tenant & { address?: string | null }).address ?? null, instagramUrl: (tenant as typeof tenant & { instagramUrl?: string | null }).instagramUrl ?? null, whatsappNumber: (tenant as typeof tenant & { whatsappNumber?: string | null }).whatsappNumber ?? null, logoUrl: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null }} />
    </SectionCard>

    <SectionCard icon="schedule" title="Horarios de atención" description="Cuándo se puede reservar un turno.">
      <BusinessHoursForm tenantSlug={tenantSlug} initialHours={tenant.businessHours.map((hour) => ({ weekday: hour.weekday, opens_at: hour.opensAt, closes_at: hour.closesAt }))} />
    </SectionCard>

    <SectionCard icon="payments" title="Política de seña" description="Cuánto pedís para asegurar un turno online.">
      <DepositSettingsForm tenantSlug={tenantSlug} current={{ depositType: tenant.settings.depositType, depositValue: tenant.settings.depositValue, depositMin: tenant.settings.depositMin }} />
    </SectionCard>

    <SectionCard icon="badge" title="Equipo" description={staffCount <= 1 ? "Hoy trabajás sola. Si sumás a alguien, la agenda se organiza por persona." : `${staffCount} profesionales activos.`}>
      <Link href={`/app/${tenantSlug}/staff`} className={buttonVariants({ variant: "secondary", size: "sm" })}><Icon name="person_add" className="text-[16px]" />{staffCount <= 1 ? "Agregar profesional" : "Gestionar equipo"}</Link>
    </SectionCard>

    <SectionCard icon="account_balance_wallet" title="Mercado Pago" description="Las señas se acreditan directo en la cuenta de la dueña.">
      <div className="flex items-center justify-between rounded-inner bg-surface-container-low p-md"><div className="flex items-center gap-2"><Icon name="account_balance_wallet" className="text-[20px] text-[#00B1EA]" /><span className="font-label-md text-label-md text-on-surface">{mpConnected ? "Cuenta conectada" : mpConnection?.status === "reconnect_required" ? "Necesita reconexión" : "No conectado"}</span></div><StatusPill status={mpConnected ? "confirmed" : "draft"}>{mpConnected ? "Activo" : "Pendiente"}</StatusPill></div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Sin conexión, el panel manual sigue funcionando pero la reserva pública permanece bloqueada.</p>
      <MercadoPagoSettings tenantSlug={tenantSlug} connected={mpConnected} feeMode={tenant.settings.mpFeeMode ?? "absorbed"} feePercent={tenant.settings.mpFeePercent ?? 0} />
    </SectionCard>
  </div>;
}
