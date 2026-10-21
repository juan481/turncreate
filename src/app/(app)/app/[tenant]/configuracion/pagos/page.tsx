import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getMpConnection } from "@/server/mercadopago/connections";
import { latestObservedMpFee } from "@/server/mercadopago/fees";
import { bookingAvailability, TRANSFER_CONFIRM_WINDOW_HOURS } from "@/server/public-booking/payment-methods";
import { Icon } from "@/components/ui/icon";
import { DepositSettingsForm } from "../deposit-settings-form";
import { MercadoPagoSettings } from "../mercadopago-settings";
import { ScreenIntro, SettingsSection } from "../settings-ui";
import { TransferSettingsForm } from "../transfer-settings-form";
import { isMpResult } from "./mp-result";
import { MpResultNotice } from "./mp-result-notice";
import { CancellationPolicyForm } from "../cancellation-policy-form";
import { DEFAULT_CANCELLATION_REFUND_HOURS, normalizeCancellationRefundHours } from "@/domain/booking/cancellation-policy";

/**
 * Pagos y señas: cuánto se pide de seña y con qué la paga la clienta
 * (Mercado Pago y/o transferencia). Acá vuelve el callback de OAuth de
 * Mercado Pago con ?mp=connected|error|denied|expired|unavailable.
 */
export default async function ConfiguracionPagosPage({ params, searchParams }: PageProps<"/app/[tenant]/configuracion/pagos">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const { mp } = await searchParams;

  const [mpConnection, observedMpFee] = await Promise.all([getMpConnection(tenant.id), latestObservedMpFee(tenant.id)]);
  const status = mpConnection?.status ?? "disconnected";
  const availability = bookingAvailability(tenant, status === "connected");
  const transfer = tenant.settings.payments?.transfer;

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Pagos y señas" description="Cuánto pedís para asegurar un turno y cómo te lo pagan." />

      {isMpResult(mp) && <MpResultNotice result={mp} />}

      {!availability.enabled && (
        <p className="flex min-w-0 gap-2 rounded-inner bg-status-draft-bg px-3 py-2.5 font-body-md text-body-md text-status-draft">
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          <span className="min-w-0">
            {availability.reason === "no_deposit"
              ? "Tu turnero todavía no toma reservas online: elegí cuánto pedís de seña."
              : "Tu turnero todavía no toma reservas online: activá Mercado Pago o la transferencia para que puedan pagar la seña."}
          </span>
        </p>
      )}

      <SettingsSection icon={<Icon name="savings" />} title="Seña" description="Lo que paga la clienta al reservar desde tu link para asegurar el turno. Nunca supera el precio del servicio.">
        <DepositSettingsForm
          tenantSlug={tenant.slug}
          current={{ depositType: tenant.settings.depositType, depositValue: tenant.settings.depositValue, depositMin: tenant.settings.depositMin }}
        />
      </SettingsSection>

      <SettingsSection icon={<Icon name="event_busy" />} title="Cancelaciones y devolución" description="Definí hasta cuándo corresponde devolver la seña.">
        <CancellationPolicyForm
          tenantSlug={tenant.slug}
          hours={normalizeCancellationRefundHours(tenant.settings.cancellationRefundHours ?? DEFAULT_CANCELLATION_REFUND_HOURS)}
        />
      </SettingsSection>

      <SettingsSection icon={<Icon name="credit_card" />} title="Mercado Pago" description="La clienta paga online y el turno queda confirmado al toque.">
        <MercadoPagoSettings
          tenantSlug={tenant.slug}
          status={status}
          enabled={tenant.settings.payments?.mercadopagoEnabled !== false}
          feeMode={tenant.settings.mpFeeMode ?? "absorbed"}
          feePercent={tenant.settings.mpFeePercent ?? 0}
          observedFee={observedMpFee}
        />
      </SettingsSection>

      <SettingsSection icon={<Icon name="account_balance" />} title="Transferencia bancaria" description="La clienta te transfiere la seña a tu alias y vos confirmás el comprobante.">
        <TransferSettingsForm
          tenantSlug={tenant.slug}
          confirmWindowHours={TRANSFER_CONFIRM_WINDOW_HOURS}
          current={{
            enabled: Boolean(transfer?.enabled),
            alias: transfer?.alias ?? "",
            cbu: transfer?.cbu ?? null,
            holderName: transfer?.holderName ?? "",
            bankName: transfer?.bankName ?? null,
          }}
        />
      </SettingsSection>
    </div>
  );
}
