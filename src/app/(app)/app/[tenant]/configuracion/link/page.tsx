import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getMpConnection } from "@/server/mercadopago/connections";
import { bookingAvailability } from "@/server/public-booking/payment-methods";
import { getPublicServiceCatalog } from "@/server/services/catalog";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { RequirementRow, ScreenIntro, SettingsSection } from "../settings-ui";
import { PublicBookingToggle } from "./public-booking-toggle";
import { PublicLinkActions } from "./public-link-actions";

export default async function ConfiguracionLinkPage({ params }: PageProps<"/app/[tenant]/configuracion/link">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const base = `/app/${tenant.slug}`;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://turn.justcreate.com.ar"}/${tenant.slug}`;

  const [mpConnection, catalog] = await Promise.all([getMpConnection(tenant.id), getPublicServiceCatalog(tenant.id)]);
  const availability = bookingAvailability(tenant, mpConnection?.status === "connected");
  const hasServices = catalog.some((category) => category.services.length > 0);
  const hasHours = tenant.businessHours.length > 0;
  const enabled = tenant.settings.publicBookingEnabled !== false;
  // Lo mismo que exige updatePublicBookingEnabled para prender el turnero.
  const ready = availability.enabled;
  const live = enabled && ready && hasServices && hasHours;

  const methods = [availability.methods.mercadopago && "Mercado Pago", availability.methods.transfer && "transferencia"].filter(Boolean).join(" y ");

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Link de reservas" description="Compartilo en tu Instagram o por WhatsApp: tus clientas eligen servicio, día y horario, y pagan la seña." />

      <SettingsSection
        icon={<Icon name="link" />}
        title="Tu turnero público"
        aside={<StatusPill status={live ? "confirmed" : "draft"}>{live ? "Activo" : enabled ? "Incompleto" : "Pausado"}</StatusPill>}
      >
        <PublicLinkActions url={publicUrl} businessName={tenant.name} />
      </SettingsSection>

      <SettingsSection icon={<Icon name="event_available" />} title="Reservas online" description="Para tomar reservas, tu turnero necesita todo esto:">
        <PublicBookingToggle tenantSlug={tenant.slug} enabled={enabled} ready={ready} publicUrl={publicUrl} />
        <ul className="space-y-2">
          <RequirementRow
            done={tenant.settings.depositType !== "none"}
            label="Una seña configurada"
            hint="La seña asegura el turno: sin seña, el turnero no toma reservas."
            href={`${base}/configuracion/pagos`}
          />
          <RequirementRow
            done={availability.methods.mercadopago || availability.methods.transfer}
            label="Un medio de pago para la seña"
            hint={methods ? `Hoy pueden pagar con ${methods}.` : "Conectá Mercado Pago o activá la transferencia."}
            href={`${base}/configuracion/pagos`}
          />
          <RequirementRow
            done={hasServices}
            label="Servicios visibles en el turnero"
            hint="Al menos un servicio activo y público, con precio."
            href={`${base}/servicios`}
            actionLabel="Cargar"
          />
          <RequirementRow
            done={hasHours}
            label="Horarios de atención"
            hint="Los turnos se ofrecen solo dentro de tus horarios."
            href={`${base}/configuracion/horarios`}
          />
        </ul>
      </SettingsSection>
    </div>
  );
}
