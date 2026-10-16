import Link from "next/link";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { listPendingTransfers } from "@/server/public-booking/transfer";
import { moneyLabel, transferTimeLeftLabel } from "@/server/public-booking/payment-methods";
import { formatInTz, formatTimeInTz } from "@/lib/dates";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/status-dot";
import { TransferDecision } from "./transfer-decision";

export default async function TransferenciasPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const transfers = await listPendingTransfers(tenant.id);
  const now = new Date();

  return (
    <div className="mx-auto max-w-[40rem] space-y-lg">
      {/* En mobile el título lo da el AppBar del shell. */}
      <h1 className="hidden font-headline-lg text-headline-lg text-on-surface lg:block">Transferencias</h1>

      <p className="flex items-start gap-2 rounded-inner bg-surface-container-low px-md py-sm font-body-sm text-body-sm text-on-surface-variant">
        <Icon name="info" className="mt-px shrink-0 text-[16px]" />
        <span className="min-w-0">
          Señas por transferencia que reservaron desde tu link. Cuando te llegue el comprobante, confirmala; si no llega a tiempo, el turno se cancela solo y el horario se libera.
        </span>
      </p>

      {transfers.length === 0 ? (
        <Card hoverLift={false} className="p-lg">
          <EmptyState
            icon={<Icon name="account_balance" />}
            title="No hay transferencias pendientes"
            description="Cuando una clienta reserve y elija pagar la seña por transferencia, la vas a ver acá para confirmarla."
          />
        </Card>
      ) : (
        <ul className="space-y-md">
          {transfers.map((transfer) => {
            const day = formatInTz(transfer.startsAt, tenant.timezone, { weekday: "short", day: "numeric", month: "numeric" });
            const time = formatTimeInTz(transfer.startsAt, tenant.timezone);
            const timeLeft = transfer.expiresAt ? transferTimeLeftLabel(transfer.expiresAt, now) : null;
            const urgent = transfer.expiresAt ? transfer.expiresAt.getTime() - now.getTime() < 2 * 60 * 60_000 : false;
            const amountLabel = moneyLabel(transfer.depositDue);
            return (
              <li key={transfer.appointmentId}>
                <Card hoverLift={false} className="space-y-md p-lg">
                  <Link href={`/app/${tenantSlug}/agenda/${transfer.appointmentId}`} className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-label-lg text-label-lg text-on-surface">{transfer.clientName || "Sin nombre"}</p>
                      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{transfer.serviceName}</p>
                      <p className="font-body-sm text-body-sm tabular-nums text-on-surface-variant first-letter:uppercase">{day} · {time} hs</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-headline-sm text-headline-sm tabular-nums text-on-surface">{amountLabel}</p>
                      <p className="font-label-sm text-label-sm text-on-surface-variant">seña</p>
                    </div>
                  </Link>
                  {timeLeft && <StatusDot tone={urgent ? "alert" : "pending"}>{timeLeft}</StatusDot>}
                  <TransferDecision tenantSlug={tenantSlug} appointmentId={transfer.appointmentId} amountLabel={amountLabel} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
