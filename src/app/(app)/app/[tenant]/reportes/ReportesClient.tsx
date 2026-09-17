"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { exportarTurnosCsv } from "./actions";

interface ReportesClientProps {
  tenantSlug: string;
  stats: {
    ingresosMes: string;
    serviciosPopulares: Array<{ name: string; count: number }>;
    tasaAusentismo: string;
  };
}

export function ReportesClient({ tenantSlug, stats }: ReportesClientProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const { filename, content } = await exportarTurnosCsv(tenantSlug);
      
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

  return (
    <div className="space-y-lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {/* Card: Ingresos por mes */}
        <Card className="flex flex-col space-y-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="payments" />
            <h2 className="font-label-lg text-label-lg">Ingresos del Mes</h2>
          </div>
          <p className="font-headline-lg text-headline-lg text-primary">{stats.ingresosMes}</p>
        </Card>

        {/* Card: Tasa de ausentismo */}
        <Card className="flex flex-col space-y-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="person_cancel" />
            <h2 className="font-label-lg text-label-lg">Tasa de Ausentismo</h2>
          </div>
          <p className="font-headline-lg text-headline-lg text-alert">{stats.tasaAusentismo}</p>
        </Card>

        {/* Card: Servicios más populares */}
        <Card className="flex flex-col space-y-4 md:col-span-1 md:row-span-2">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Icon name="star" />
            <h2 className="font-label-lg text-label-lg">Servicios Populares</h2>
          </div>
          <ul className="space-y-3">
            {stats.serviciosPopulares.map((servicio, i) => (
              <li key={i} className="flex justify-between items-center border-b border-border pb-2 last:border-0 last:pb-0">
                <span className="font-body-md text-body-md text-on-surface">{servicio.name}</span>
                <span className="font-label-md text-label-md bg-surface-muted px-2 py-1 rounded text-on-surface-variant">{servicio.count} turnos</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="flex justify-end pt-lg">
        <Button onClick={handleExport} disabled={isExporting} variant="primary">
          <Icon name="download" />
          {isExporting ? "Exportando..." : "Exportar Turnos (CSV)"}
        </Button>
      </div>
    </div>
  );
}
