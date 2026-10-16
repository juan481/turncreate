import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getMpConnection } from "@/server/mercadopago/connections";
import { bookingAvailability, isTransferReady } from "@/server/public-booking/payment-methods";
import { planFeatures } from "@/lib/plans";
import { HubTile, ScreenIntro, type HubTileTone } from "./settings-ui";
import { depositSummary, hoursSummary } from "./summaries";

/**
 * Hub de Configuración: una botonera de accesos grandes, cada uno a su
 * propia pantalla (Información del local, Horarios, Pagos y señas, Equipo,
 * Link de reservas, Ayuda) con una línea de estado viva. Antes era una sola
 * página larguísima con todos los formularios apilados.
 */
export default async function ConfiguracionPage({ params }: PageProps<"/app/[tenant]/configuracion">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const features = planFeatures(tenant);
  const teamLocked = features.maxStaff <= 1;
  const base = `/app/${tenant.slug}`;

  const [mpConnection, staffCount] = await Promise.all([
    getMpConnection(tenant.id),
    teamLocked
      ? Promise.resolve(0)
      : firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).count().get().then((snapshot) => snapshot.data().count),
  ]);

  const mpConnected = mpConnection?.status === "connected";
  const availability = bookingAvailability(tenant, mpConnected);
  const transferReady = isTransferReady(tenant.settings.payments?.transfer);
  const bookingOn = tenant.settings.publicBookingEnabled !== false;

  const logoUrl = tenant.logoUrl ?? null;
  const localStatus: [string, HubTileTone] = !logoUrl ? ["Falta cargar el logo", "warning"] : [tenant.address?.trim() || "Nombre, logo y contacto", "neutral"];

  const paymentsStatus = ((): [string, HubTileTone] => {
    if (mpConnection?.status === "reconnect_required") return ["Mercado Pago necesita reconexión", "warning"];
    const deposit = depositSummary(tenant.settings);
    if (!deposit) return ["Sin seña configurada", "warning"];
    const methods = [availability.methods.mercadopago && "Mercado Pago conectado", transferReady && "Transferencia"].filter(Boolean);
    if (methods.length === 0) return [`${deposit} · falta un medio de pago`, "warning"];
    return [`${deposit} · ${methods.join(" + ")}`, "neutral"];
  })();

  const linkStatus: [string, HubTileTone] = !bookingOn
    ? ["Reservas pausadas", "warning"]
    : availability.enabled
      ? ["Tomando reservas", "ok"]
      : ["Todavía no toma reservas", "warning"];

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Configuración" description="Datos del local, horarios, cobros y tu link de reservas." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <HubTile href={`${base}/configuracion/local`} icon="storefront" title="Información del local" status={localStatus[0]} tone={localStatus[1]} />
        <HubTile href={`${base}/configuracion/horarios`} icon="schedule" title="Horarios" status={hoursSummary(tenant.businessHours)} tone={tenant.businessHours.length ? "neutral" : "warning"} />
        <HubTile href={`${base}/configuracion/pagos`} icon="payments" title="Pagos y señas" status={paymentsStatus[0]} tone={paymentsStatus[1]} />
        <HubTile
          href={`${base}/staff`}
          icon="badge"
          title="Equipo"
          locked={teamLocked}
          status={teamLocked ? "Disponible en el plan Equipo" : `${staffCount} profesional${staffCount === 1 ? "" : "es"} activo${staffCount === 1 ? "" : "s"}`}
        />
        <HubTile href={`${base}/configuracion/link`} icon="link" title="Link de reservas" status={linkStatus[0]} tone={linkStatus[1]} />
        <HubTile href={`${base}/ayuda`} icon="help" title="Ayuda" status="Preguntas frecuentes y soporte" />
      </div>
    </div>
  );
}
