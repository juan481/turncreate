import { requireTenantPage } from "@/server/firebase/tenant-page";
import { planFeatures } from "@/lib/plans";
import { Icon } from "@/components/ui/icon";
import { BusinessHoursForm } from "../business-hours-form";
import { ScreenIntro, SettingsSection } from "../settings-ui";

export default async function ConfiguracionHorariosPage({ params }: PageProps<"/app/[tenant]/configuracion/horarios">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const team = planFeatures(tenant).maxStaff > 1;

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Horarios" description="Cuándo está abierto el local y se puede reservar un turno." />
      <SettingsSection
        icon={<Icon name="schedule" />}
        title="Horarios de atención"
        description={team ? "Cada profesional puede tener su propio horario dentro de este, desde Equipo." : "Tu turnero ofrece turnos solo dentro de estas franjas."}
      >
        <BusinessHoursForm
          tenantSlug={tenant.slug}
          initialHours={tenant.businessHours.map((hour) => ({ weekday: hour.weekday, opens_at: hour.opensAt, closes_at: hour.closesAt }))}
        />
      </SettingsSection>
    </div>
  );
}
