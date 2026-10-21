import { requireTenantPage } from "@/server/firebase/tenant-page";
import { Icon } from "@/components/ui/icon";
import { BusinessInfoForm } from "../business-info-form";
import { LogoUploader } from "../logo-uploader";
import { ScreenIntro, SettingsSection } from "../settings-ui";
import { BrandColorForm } from "../brand-color-form";

export default async function ConfiguracionLocalPage({ params }: PageProps<"/app/[tenant]/configuracion/local">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Información del local" description="Lo que ve la clienta arriba de tu turnero público." />
      <SettingsSection icon={<Icon name="storefront" />} title="Datos del local" description="Nombre, logo, dirección y cómo contactarte.">
        <LogoUploader tenantSlug={tenant.slug} tenantName={tenant.name} logoUrl={tenant.logoUrl ?? null} />
        <BusinessInfoForm
          tenantSlug={tenant.slug}
          tenant={{
            name: tenant.name,
            description: tenant.description ?? null,
            address: tenant.address ?? null,
            instagramUrl: tenant.instagramUrl ?? null,
            whatsappNumber: tenant.whatsappNumber ?? null,
          }}
        />
      </SettingsSection>
      <SettingsSection icon={<Icon name="palette" />} title="Color de tu marca" description="Personalizá el panel y el turnero que ven tus clientes.">
        <BrandColorForm tenantSlug={tenant.slug} brandColor={tenant.brandColor ?? null} />
      </SettingsSection>
    </div>
  );
}
