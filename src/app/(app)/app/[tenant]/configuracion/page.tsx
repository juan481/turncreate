import Link from "next/link";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { buttonVariants } from "@/components/ui/button";
import { BusinessInfoForm } from "./business-info-form";
import { BusinessHoursForm } from "./business-hours-form";
import { DepositSettingsForm } from "./deposit-settings-form";

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card hoverLift={false} className="space-y-md p-xl">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-soft text-secondary">
          <Icon name={icon} className="text-[18px]" />
        </span>
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default async function ConfiguracionPage({
  params,
}: PageProps<"/app/[tenant]/configuracion">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;
  const staffCount = (await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).get()).size;

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Configuración</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Datos del local, horarios, señas e integraciones.
        </p>
      </div>

      <SectionCard icon="storefront" title="Datos del negocio" description="Lo que ve el cliente en tu turnero público.">
        <BusinessInfoForm
          tenantSlug={tenantSlug}
          tenant={{
            name: tenant.name,
            address: (tenant as typeof tenant & { address?: string | null }).address ?? null,
            instagramUrl: (tenant as typeof tenant & { instagramUrl?: string | null }).instagramUrl ?? null,
            whatsappNumber: (tenant as typeof tenant & { whatsappNumber?: string | null }).whatsappNumber ?? null,
            logoUrl: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null,
          }}
        />
      </SectionCard>

      <SectionCard icon="schedule" title="Horarios de atención" description="Cuándo se puede reservar un turno.">
        <BusinessHoursForm tenantSlug={tenantSlug} initialHours={tenant.businessHours.map((hour) => ({ weekday: hour.weekday, opens_at: hour.opensAt, closes_at: hour.closesAt }))} />
      </SectionCard>

      <SectionCard
        icon="payments"
        title="Política de seña"
        description="Cuánto le pedís al cliente para asegurar su turno online."
      >
        <DepositSettingsForm
          tenantSlug={tenantSlug}
          current={{
            depositType: tenant.settings.depositType,
            depositValue: tenant.settings.depositValue,
            depositMin: tenant.settings.depositMin,
          }}
        />
      </SectionCard>

      <SectionCard
        icon="badge"
        title="Equipo"
        description={
          staffCount <= 1
            ? "Hoy trabajás solo/a. Si sumás a alguien, la agenda se organiza sola por persona."
            : `${staffCount} profesionales activos.`
        }
      >
        <Link href={`/app/${tenantSlug}/staff`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Icon name="person_add" className="text-[16px]" />
          {staffCount <= 1 ? "Agregar profesional" : "Gestionar equipo"}
        </Link>
      </SectionCard>

      <SectionCard
        icon="account_balance_wallet"
        title="Mercado Pago"
        description="Para que las señas del turnero público se acrediten directo en tu cuenta."
      >
        <div className="flex items-center justify-between rounded-inner bg-surface-container-low p-md">
          <div className="flex items-center gap-2">
            <Icon name="account_balance_wallet" className="text-[20px] text-[#00B1EA]" />
            <span className="font-label-md text-label-md text-on-surface">
              No conectado
            </span>
          </div>
          <StatusPill status="draft">
            Pendiente
          </StatusPill>
        </div>
        {(
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no está disponible conectar Mercado Pago desde acá — requiere dar de alta la aplicación de
            Mercado Pago de TurnCreate primero. Mientras tanto, las señas del turnero público quedan simuladas.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
