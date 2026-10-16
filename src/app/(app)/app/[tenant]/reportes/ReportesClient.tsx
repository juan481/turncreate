"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/modal";
import { HorizontalBarList } from "@/components/ui/bar-chart";
import { exportarTurnosCsv } from "./actions";

/*
 * Solo las piezas que necesitan el navegador (estado, router, descarga).
 * El resto de Reportes es Server Components en sections.tsx, que se
 * streamean por separado con <Suspense>.
 */

type ServicioPopular = { id: string; name: string; count: number; income: number };

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export function MonthSelect({
  tenantSlug,
  monthISO,
  monthOptions,
}: {
  tenantSlug: string;
  monthISO: string;
  monthOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor="reportes-mes" className="sr-only">
        Mes del reporte
      </label>
      <select
        id="reportes-mes"
        value={monthISO}
        onChange={(e) => {
          const value = e.target.value;
          startTransition(() => router.push(`/app/${tenantSlug}/reportes?month=${value}`));
        }}
        className="h-11 w-full min-w-0 rounded-pill border-0 bg-surface-muted px-4 font-body-lg text-body-lg capitalize text-on-surface sm:w-auto"
      >
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="capitalize">
            {opt.label}
          </option>
        ))}
      </select>
      {pending && <Icon name="progress_activity" className="shrink-0 animate-spin text-[18px] text-on-surface-variant" />}
    </div>
  );
}

/**
 * "Servicios más pedidos": cada fila abre un sheet con el detalle y un link
 * para editar el servicio.
 */
export function ServicesCard({
  tenantSlug,
  services,
  ticketMasAlto,
}: {
  tenantSlug: string;
  services: ServicioPopular[];
  ticketMasAlto: number;
}) {
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);
  const openService = useMemo(() => services.find((s) => s.id === openServiceId) ?? null, [services, openServiceId]);

  return (
    <>
      <Card hoverLift={false} className="space-y-md p-lg">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-status-draft-bg text-status-draft">
              <Icon name="star" className="text-[16px]" />
            </span>
            <h2 className="truncate font-headline-sm text-headline-sm text-on-surface">Servicios más pedidos</h2>
          </div>
          <span className="max-w-full truncate rounded-pill bg-surface-container-low px-3 py-1 font-label-sm text-label-sm tabular-nums text-on-surface-variant">
            Ticket más alto: {money(ticketMasAlto)}
          </span>
        </div>
        {services.length === 0 ? (
          <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay turnos completados este mes.
          </p>
        ) : (
          <HorizontalBarList
            data={services.map((s) => ({ id: s.id, label: s.name, value: s.count }))}
            formatValue={(v) => `${v} turno${v === 1 ? "" : "s"}`}
            onItemClick={(id) => setOpenServiceId(id)}
          />
        )}
      </Card>

      <Modal open={openService !== null} onClose={() => setOpenServiceId(null)} variant="sheet" title={openService?.name}>
        {openService && (
          <div className="space-y-md">
            <div className="grid grid-cols-2 gap-md">
              <div className="min-w-0 rounded-inner bg-surface-container-low p-3.5">
                <p className="truncate font-label-sm text-label-sm text-on-surface-variant">Turnos este mes</p>
                <p className="truncate font-headline-md text-headline-md tabular-nums text-on-surface">{openService.count}</p>
              </div>
              <div className="min-w-0 rounded-inner bg-surface-container-low p-3.5">
                <p className="truncate font-label-sm text-label-sm text-on-surface-variant">Ingresos este mes</p>
                <p className="truncate font-headline-sm text-headline-sm tabular-nums text-on-surface sm:text-headline-md" title={money(openService.income)}>
                  {money(openService.income)}
                </p>
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
    </>
  );
}

/** Exportar: acción secundaria e infrecuente, va al final y chica. */
export function ExportButton({ tenantSlug, monthISO }: { tenantSlug: string; monthISO: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      const { filename, content } = await exportarTurnosCsv(tenantSlug, monthISO);
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (exportError) {
      console.error("Error al exportar CSV:", exportError);
      setError("No se pudo exportar. Probá de nuevo en un rato.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 border-t border-border pt-md">
      <Button onClick={handleExport} disabled={isExporting} variant="secondary">
        <Icon name="download" className="text-[16px]" />
        {isExporting ? "Exportando..." : "Exportar turnos (CSV)"}
      </Button>
      {error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>}
    </div>
  );
}
