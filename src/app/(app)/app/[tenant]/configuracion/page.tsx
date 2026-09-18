import Link from "next/link";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
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
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [tenantRowRes, businessHoursRes, mpIntegrationRes, staffCountRes] = await Promise.all([
    supabase.from("tenants").select("name, address, instagram_url, whatsapp_number").eq("id", tenant.id).single(),
    supabase.from("business_hours").select("weekday, opens_at, closes_at").eq("tenant_id", tenant.id),
    supabase
      .from("tenant_integrations")
      .select("status, mp_user_id")
      .eq("tenant_id", tenant.id)
      .eq("provider", "mercadopago")
      .maybeSingle(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("active", true),
  ]);

  if (tenantRowRes.error) throw tenantRowRes.error;
  if (businessHoursRes.error) throw businessHoursRes.error;

  const tenantRow = tenantRowRes.data;
  const mpIntegration = mpIntegrationRes.data;
  const mpConnected = mpIntegration?.status === "connected";
  const staffCount = staffCountRes.count ?? 0;

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
            name: tenantRow.name,
            address: tenantRow.address,
            instagramUrl: tenantRow.instagram_url,
            whatsappNumber: tenantRow.whatsapp_number,
          }}
        />
      </SectionCard>

      <SectionCard icon="schedule" title="Horarios de atención" description="Cuándo se puede reservar un turno.">
        <BusinessHoursForm tenantSlug={tenantSlug} initialHours={businessHoursRes.data} />
      </SectionCard>

      <SectionCard
        icon="payments"
        title="Política de seña"
        description="Cuánto le pedís al cliente para asegurar su turno online."
      >
        <DepositSettingsForm
          tenantSlug={tenantSlug}
          current={{
            depositType: (tenant.tenant_settings?.deposit_type as "none" | "percent" | "fixed") ?? "none",
            depositValue: tenant.tenant_settings?.deposit_value ?? 0,
            depositMin: tenant.tenant_settings?.deposit_min ?? 0,
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
              {mpConnected ? `Conectado (${mpIntegration?.mp_user_id})` : "No conectado"}
            </span>
          </div>
          <StatusPill status={mpConnected ? "confirmed" : "draft"}>
            {mpConnected ? "Activo" : "Pendiente"}
          </StatusPill>
        </div>
        {!mpConnected && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no está disponible conectar Mercado Pago desde acá — requiere dar de alta la aplicación de
            Mercado Pago de TurnCreate primero. Mientras tanto, las señas del turnero público quedan simuladas.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
