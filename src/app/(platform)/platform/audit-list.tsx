import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { StatusDot } from "@/components/ui/status-dot";
import type { AuditEntry } from "@/server/platform/audit";
import {
  AUDIT_ACTION_LABEL,
  TENANT_STATUS_LABEL,
  auditActionTone,
  normalizeTenantStatus,
  platformDateTimeLabel,
} from "@/server/platform/model";

function stateLabel(entry: AuditEntry, value: string): string {
  if (entry.action === "tenant.booking_on" || entry.action === "tenant.booking_off") {
    return value === "on" ? "prendido" : "apagado";
  }
  return TENANT_STATUS_LABEL[normalizeTenantStatus(value)].toLowerCase();
}

/**
 * Lista de cambios de `platformAudit`. `showTenant`: en la auditoría global
 * cada fila dice (y linkea) a qué local corresponde; en el detalle de un
 * local sobra.
 */
export function AuditList({ entries, showTenant = false }: { entries: AuditEntry[]; showTenant?: boolean }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="history" />}
        title="Sin cambios registrados"
        description="Cada vez que apagues o prendas un local o su turnero, va a quedar anotado acá con el motivo."
      />
    );
  }

  return (
    <ol className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex min-w-0 flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <StatusDot tone={auditActionTone(entry.action)} className="font-label-md text-label-md">
              {AUDIT_ACTION_LABEL[entry.action]}
            </StatusDot>
            <time
              dateTime={entry.atISO ?? undefined}
              className="font-label-sm text-label-sm tabular-nums text-on-surface-variant"
            >
              {platformDateTimeLabel(entry.atISO)}
            </time>
          </div>
          {showTenant && (
            <Link
              href={`/platform/${entry.tenantId}`}
              className="flex min-h-11 min-w-0 items-center gap-1 font-label-lg text-label-lg text-on-surface hover:text-primary"
            >
              <span className="truncate">{entry.tenantName || entry.tenantId}</span>
              <Icon name="chevron_right" className="shrink-0 text-[16px] text-on-surface-variant" />
            </Link>
          )}
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            De {stateLabel(entry, entry.from)} a {stateLabel(entry, entry.to)}
            {entry.actorEmail && <> · por <span className="break-all">{entry.actorEmail}</span></>}
          </p>
          {entry.reason && (
            <p className="break-words rounded-sm bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface">
              “{entry.reason}”
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
