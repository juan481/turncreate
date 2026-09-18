"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { exportarTurnosCsv } from "./actions";

interface ReportesClientProps {
  tenantSlug: string;
  monthISO: string;
  monthOptions: { value: string; label: string }[];
  stats: {
    turnosRealizados: number;
    clientesQueVinieron: number;
    clientesNuevos: number;
    clientesQueNoVolvieron: number;
    ingresos: number;
    egresos: number;
    ticketMasAlto: number;
    serviciosPopulares: { name: string; count: number }[];
    evolucionMensual: { label: string; amount: number }[];
    profesionalDelMes: { name: string; count: number; photo: string | null } | null;
  };
}

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function KpiCard({ icon, color, label, value, hint }: { icon: string; color: string; label: string; value: string; hint?: string }) {
  return (
    <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon name={icon} className="text-[16px]" />
        </span>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      </div>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
      {hint && <p className="font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
    </Card>
  );
}

export function ReportesClient({ tenantSlug, monthISO, monthOptions, stats }: ReportesClientProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const handleMonthChange = (value: string) => {
    router.push(`/app/${tenantSlug}/reportes?month=${value}`);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { filename, content } = await exportarTurnosCsv(tenantSlug, monthISO);

      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error al exportar CSV:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const balance = stats.ingresos - stats.egresos;
  const maxEvolucion = Math.max(...stats.evolucionMensual.map((m) => m.amount), 1);

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={monthISO}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="h-11 rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md capitalize text-on-surface"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="capitalize">
              {opt.label}
            </option>
          ))}
        </select>
        <Button onClick={handleExport} disabled={isExporting} variant="secondary">
          <Icon name="download" className="text-[18px]" />
          {isExporting ? "Exportando..." : "Exportar turnos (CSV)"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <KpiCard icon="event_available" color="#22C55E" label="Turnos realizados" value={String(stats.turnosRealizados)} />
        <KpiCard icon="group" color="#7069E8" label="Clientes atendidos" value={String(stats.clientesQueVinieron)} />
        <KpiCard icon="person_add" color="#0EA5E9" label="Clientes nuevos" value={String(stats.clientesNuevos)} />
        <KpiCard
          icon="person_off"
          color="#EF4444"
          label="No volvieron"
          value={String(stats.clientesQueNoVolvieron)}
          hint="vs. el mes anterior"
        />
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
        <KpiCard icon="payments" color="#22C55E" label="Ingresos del mes" value={money(stats.ingresos)} />
        <KpiCard icon="trending_down" color="#EF4444" label="Egresos del mes" value={money(stats.egresos)} />
        <KpiCard
          icon="account_balance"
          color={balance >= 0 ? "#22C55E" : "#EF4444"}
          label="Balance del mes"
          value={money(balance)}
        />
      </div>

      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="show_chart" className="text-[16px]" />
          </span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Cómo vienen los últimos meses</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Ingresos cobrados, mes a mes.</p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 pt-md" style={{ height: 140 }}>
          {stats.evolucionMensual.map((m, i) => {
            const isLast = i === stats.evolucionMensual.length - 1;
            const heightPct = Math.max((m.amount / maxEvolucion) * 100, 3);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {m.amount > 0 ? `$${Math.round(m.amount / 1000)}k` : ""}
                </span>
                <div className="flex h-full w-full items-end">
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${isLast ? "bg-primary" : "bg-secondary-soft"}`}
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="font-label-sm text-label-sm capitalize text-on-surface-variant">{m.label}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {stats.profesionalDelMes && (
        <Card hoverLift={false} className="flex items-center gap-3 p-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="workspace_premium" className="text-[18px]" />
          </span>
          <div className="flex flex-1 items-center gap-3">
            <Avatar name={stats.profesionalDelMes.name} src={stats.profesionalDelMes.photo} size="md" />
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant">Profesional del mes</p>
              <p className="font-headline-sm text-headline-sm text-on-surface">
                {stats.profesionalDelMes.name}{" "}
                <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">
                  · {stats.profesionalDelMes.count} turnos completados
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-draft-bg text-status-draft">
              <Icon name="star" className="text-[16px]" />
            </span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Servicios más pedidos</h2>
          </div>
          <span className="rounded-pill bg-surface-container-low px-3 py-1 font-label-sm text-label-sm text-on-surface-variant">
            Ticket más alto: {money(stats.ticketMasAlto)}
          </span>
        </div>
        {stats.serviciosPopulares.length === 0 ? (
          <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay turnos completados este mes.
          </p>
        ) : (
          <ul className="space-y-2">
            {stats.serviciosPopulares.map((servicio) => (
              <li key={servicio.name} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="font-body-md text-body-md text-on-surface">{servicio.name}</span>
                <span className="rounded-pill bg-surface-container-low px-3 py-1 font-label-md text-label-md text-on-surface-variant">
                  {servicio.count} turnos
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
