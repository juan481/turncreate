import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { KpiTile } from "@/components/ui/kpi-tile";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";
import { StatusPill } from "@/components/ui/status-pill";
import { VerticalBarChart } from "@/components/ui/bar-chart";
import { isPlatformAdmin } from "@/server/platform";
import { getTenantAudit } from "@/server/platform/audit";
import {
  TENANT_STATUS_LABEL,
  compactMoney,
  formatMoney,
  isValidTenantId,
  tenantStatusTone,
} from "@/server/platform/model";
import { getPlatformTenantDetail, type MpStatus } from "@/server/platform/stats";
import { AuditList } from "../audit-list";
import { TenantControls } from "./tenant-controls";

const MP_LABEL: Record<MpStatus, { label: string; tone: StatusDotTone }> = {
  connected: { label: "Conectado", tone: "confirmed" },
  reconnect_required: { label: "Hay que reconectar", tone: "draft" },
  disconnected: { label: "Desconectado", tone: "neutral" },
  none: { label: "Nunca se conectó", tone: "neutral" },
};

function ConfigRow({ label, tone, value, hint }: { label: string; tone: StatusDotTone; value: string; hint?: string | null }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <dt className="font-label-lg text-label-lg text-on-surface">{label}</dt>
        {hint && <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
      </div>
      <dd className="min-w-0 max-w-[55%] shrink-0 text-right">
        <StatusDot tone={tone} className="max-w-full">{value}</StatusDot>
      </dd>
    </div>
  );
}

export default async function PlatformTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  // Chequeo propio (no alcanza el del layout: se renderizan en paralelo y
  // el payload RSC de la página saldría igual).
  if (!(await isPlatformAdmin())) notFound();
  const { tenantId } = await params;
  if (!isValidTenantId(tenantId)) notFound();

  const [tenant, audit] = await Promise.all([getPlatformTenantDetail(tenantId), getTenantAudit(tenantId, 50)]);
  if (!tenant) notFound();
  const { usage, analytics, config } = tenant;

  return (
    <div className="space-y-lg">
      <Link
        href="/platform"
        className="inline-flex h-11 items-center gap-1.5 rounded-pill pr-3 font-label-md text-label-md text-on-surface-variant hover:text-on-surface"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Todos los locales
      </Link>

      {/* Header */}
      <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
              {tenant.name}
            </h1>
            {tenant.slug && (
              <a
                href={`/${tenant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 max-w-full items-center gap-1 font-body-md text-body-md text-primary hover:underline"
              >
                <span className="truncate">/{tenant.slug}</span>
                <Icon name="open_in_new" className="shrink-0 text-[14px]" />
              </a>
            )}
          </div>
          <StatusPill status={tenantStatusTone(tenant.status)} className="self-start">
            {TENANT_STATUS_LABEL[tenant.status]}
          </StatusPill>
        </div>

        <dl className="grid grid-cols-1 gap-3 font-body-sm text-body-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Dueña</dt>
            <dd className="min-w-0 text-on-surface">
              {tenant.ownerName && <span className="block truncate">{tenant.ownerName}</span>}
              {tenant.ownerEmail ? (
                <a href={`mailto:${tenant.ownerEmail}`} className="block truncate text-primary hover:underline">{tenant.ownerEmail}</a>
              ) : (
                <span className="text-on-surface-variant">Sin dueña registrada</span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Plan</dt>
            <dd className="truncate text-on-surface">{tenant.plan}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Alta</dt>
            <dd className="tabular-nums text-on-surface">{tenant.createdLabel}</dd>
          </div>
          <div className="min-w-0">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">ID</dt>
            <dd className="break-all font-label-md text-label-md text-on-surface-variant">{tenant.id}</dd>
          </div>
        </dl>

        {tenant.suspension && (
          <div role="status" className="flex min-w-0 gap-3 rounded-inner bg-status-alert-bg p-3.5 text-status-alert">
            <Icon name="block" className="mt-0.5 shrink-0 text-[18px]" />
            <div className="min-w-0 font-body-sm text-body-sm">
              <p className="font-label-lg text-label-lg">Apagado desde el {tenant.suspension.atLabel}</p>
              {tenant.suspension.reason && <p className="break-words">Motivo: {tenant.suspension.reason}</p>}
              {tenant.suspension.by && <p className="break-all opacity-80">Por {tenant.suspension.by}</p>}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-lg">
          {/* Uso */}
          <section aria-labelledby="uso-title" className="space-y-md">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="uso-title" className="font-headline-sm text-headline-sm text-on-surface">Uso</h2>
              <StatusDot tone={usage.lastActivityTone}>
                Última actividad: {usage.lastActivityLabel}
              </StatusDot>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiTile
                emphasis
                icon={<Icon name="payments" />}
                label="Cobrado · 30 días"
                value={compactMoney(usage.collected30d)}
                title={formatMoney(usage.collected30d)}
                hint={`${usage.payments30d} pago${usage.payments30d === 1 ? "" : "s"} aprobado${usage.payments30d === 1 ? "" : "s"}`}
              />
              <KpiTile icon={<Icon name="event_available" />} label="Turnos cargados · 7 días" value={usage.appointments7d} />
              <KpiTile icon={<Icon name="calendar_month" />} label="Turnos cargados · 30 días" value={usage.appointments30d} />
              <KpiTile icon={<Icon name="group" />} label="Clientes" value={usage.clients.toLocaleString("es-AR")} hint="Total cargadas" />
              <KpiTile icon={<Icon name="badge" />} label="Profesionales activos" value={usage.activeStaff} />
              <KpiTile icon={<Icon name="spa" />} label="Servicios activos" value={usage.activeServices} />
              <KpiTile
                icon={<Icon name="visibility" />}
                label="Visitas · 14 días"
                value={analytics.views.toLocaleString("es-AR")}
                hint={`${analytics.bookingStarted} reservas iniciadas`}
              />
              <KpiTile
                icon={<Icon name="trending_up" />}
                label="Conversión · 14 días"
                value={`${analytics.conversion.toLocaleString("es-AR")}%`}
                hint={`${analytics.confirmed} confirmados online`}
              />
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Último turno cargado: <span className="tabular-nums">{usage.lastActivityAtLabel}</span>. Los turnos cuentan por fecha de carga (agenda o turnero), no por la fecha del turno.
            </p>
          </section>

          <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Visitas al turnero</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Día por día.</p>
            </div>
            <div className="sm:hidden">
              <VerticalBarChart height={130} data={analytics.days.slice(-7)} />
            </div>
            <div className="hidden sm:block">
              <VerticalBarChart height={140} data={analytics.days} />
            </div>
          </Card>

          {/* Auditoría del local */}
          <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Auditoría</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Quién lo apagó o prendió, cuándo y por qué.</p>
            </div>
            <AuditList entries={audit} />
          </Card>
        </div>

        <div className="min-w-0 space-y-lg">
          {/* Encendido */}
          <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Encendido</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Cada cambio pide confirmación y queda en la auditoría.</p>
            </div>
            <TenantControls
              tenantId={tenant.id}
              tenantName={tenant.name}
              status={tenant.status}
              bookingEnabled={config.bookingEnabled}
              bookingReady={config.requirementsMet}
            />
          </Card>

          {/* Configuración */}
          <Card hoverLift={false} className="min-w-0 space-y-md p-lg">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Configuración</h2>
            <dl className="divide-y divide-border">
              <ConfigRow
                label="Turnero público"
                tone={config.bookingEnabled ? "confirmed" : "neutral"}
                value={config.bookingEnabled ? "Prendido" : "Apagado"}
              />
              <ConfigRow
                label="Toma reservas"
                tone={config.bookingOpen ? "confirmed" : "alert"}
                value={config.bookingOpen ? "Sí" : "No"}
                hint={config.bookingBlockedReason}
              />
              <ConfigRow label="Seña" tone={config.deposit === "Sin seña" ? "draft" : "confirmed"} value={config.deposit} />
              <ConfigRow
                label="Mercado Pago"
                tone={MP_LABEL[config.mpStatus].tone}
                value={MP_LABEL[config.mpStatus].label}
                hint={config.mpStatus === "connected" && !config.mpEnabled ? "Conectado, pero la dueña lo desactivó en el turnero" : null}
              />
              <ConfigRow
                label="Transferencia"
                tone={config.transferReady ? "confirmed" : "neutral"}
                value={config.transferReady ? "Lista" : "No configurada"}
              />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
