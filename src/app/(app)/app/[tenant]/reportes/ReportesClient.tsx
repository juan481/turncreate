"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { VerticalBarChart, HorizontalBarList } from "@/components/ui/bar-chart";
import { exportarTurnosCsv } from "./actions";

type ServicioPopular = { id: string; name: string; count: number; income: number };

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
    serviciosPopulares: ServicioPopular[];
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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <Icon name={icon} className="text-[16px]" />
        </span>
        <p className="truncate font-label-sm text-label-sm text-on-surface-variant">{label}</p>
      </div>
      <p className="font-headline-md text-headline-md tabular-nums text-on-surface">{value}</p>
      {hint && <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{hint}</p>}
    </Card>
  );
}

export function ReportesClient({ tenantSlug, monthISO, monthOptions, stats }: ReportesClientProps) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);

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
  const openService = useMemo(
    () => stats.serviciosPopulares.find((s) => s.id === openServiceId) ?? null,
    [stats.serviciosPopulares, openServiceId],
  );

  return (
    <div className="space-y-lg">
      <select
        value={monthISO}
        onChange={(e) => handleMonthChange(e.target.value)}
        className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md capitalize text-on-surface sm:w-auto"
      >
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="capitalize">
            {opt.label}
          </option>
        ))}
      </select>

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

      {/* Gráfico de evolución mensual con la primitiva VerticalBarChart --
          el chart hecho a mano antes no se veía: el contenedor raíz tenía
          altura explícita pero las columnas de adentro no, y un `height:N%`
          sin un ancestro con altura explícita en la cadena colapsa a 0.
          Bien arriba y sin scrollear, que fue el pedido explícito. */}
      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="show_chart" className="text-[16px]" />
          </span>
          <div className="min-w-0">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Cómo vienen los últimos meses</h2>
            <p className="truncate font-body-sm text-body-sm text-on-surface-variant">Ingresos facturados, mes a mes.</p>
          </div>
        </div>
        <VerticalBarChart
          data={stats.evolucionMensual.map((m) => ({ label: m.label, value: m.amount }))}
          formatValue={(v) => `$${Math.round(v / 1000)}k`}
        />
      </Card>

      {stats.profesionalDelMes && (
        <Card hoverLift={false} className="flex items-center gap-3 p-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="workspace_premium" className="text-[18px]" />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={stats.profesionalDelMes.name} src={stats.profesionalDelMes.photo} size="md" />
            <div className="min-w-0">
              <p className="font-label-sm text-label-sm text-on-surface-variant">Profesional del mes</p>
              <p className="truncate font-headline-sm text-headline-sm text-on-surface">
                {stats.profesionalDelMes.name}{" "}
                <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">
                  · {stats.profesionalDelMes.count} turnos completados
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* "Servicios más pedidos" ahora es clickeable: cada fila abre un
          sheet con el detalle y un link para editar el servicio. Se
          usa HorizontalBarList (ya soporta onItemClick) en vez de la
          lista <li> sin acción de antes. */}
      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-draft-bg text-status-draft">
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
          <HorizontalBarList
            data={stats.serviciosPopulares.map((s) => ({ id: s.id, label: s.name, value: s.count }))}
            formatValue={(v) => `${v} turno${v === 1 ? "" : "s"}`}
            onItemClick={(id) => setOpenServiceId(id)}
          />
        )}
      </Card>

      {/* Exportar: acción secundaria e infrecuente -- antes era lo primero
          en la pantalla con un botón enorme, antes de entender nada. Ahora
          va al final, chica. */}
      <div className="flex justify-end border-t border-border pt-md">
        <Button onClick={handleExport} disabled={isExporting} variant="secondary" size="sm">
          <Icon name="download" className="text-[16px]" />
          {isExporting ? "Exportando..." : "Exportar turnos (CSV)"}
        </Button>
      </div>

      <Modal open={openService !== null} onClose={() => setOpenServiceId(null)} variant="sheet" title={openService?.name}>
        {openService && (
          <div className="space-y-md">
            <div className="grid grid-cols-2 gap-md">
              <div className="rounded-inner bg-surface-container-low p-3.5">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Turnos este mes</p>
                <p className="font-headline-md text-headline-md tabular-nums text-on-surface">{openService.count}</p>
              </div>
              <div className="rounded-inner bg-surface-container-low p-3.5">
                <p className="font-label-sm text-label-sm text-on-surface-variant">Ingresos este mes</p>
                <p className="font-headline-md text-headline-md tabular-nums text-on-surface">{money(openService.income)}</p>
              </div>
            </div>
            <Link
              href={`/app/${tenantSlug}/servicios/${openService.id}`}
              className="flex h-11 items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-muted"
            >
              <Icon name="edit" className="text-[16px]" />
              Editar servicio
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}
