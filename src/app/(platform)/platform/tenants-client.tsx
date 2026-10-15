"use client";

import { useState, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { toggleTenantStatusAction } from "./actions";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  analytics: {
    views: number;
    appointmentConfirmed: number;
    viewToConfirmationRate: number;
  };
};

export function TenantsClient({ tenants }: { tenants: Tenant[] }) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggle = (id: string, currentStatus: string) => {
    startTransition(async () => {
      setErrorMsg(null);
      const res = await toggleTenantStatusAction(id, currentStatus);
      if (!res.success) {
        setErrorMsg(res.error || "Error al cambiar estado");
      }
    });
  };

  const getStatusPillType = (status: string): StatusPillStatus => {
    switch (status) {
      case "active":
        return "confirmed";
      case "suspended":
        return "alert";
      case "onboarding":
        return "pending";
      default:
        return "draft";
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Locales registrados</h2>
      
      {errorMsg && (
        <div className="bg-status-alert-bg text-status-alert p-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div className="rounded-inner border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Local</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Visitas · 14d</TableHead>
              <TableHead>Confirmados · 14d</TableHead>
              <TableHead>Conversión</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell>{t.slug}</TableCell>
                <TableCell>
                  <StatusPill status={getStatusPillType(t.status)}>
                    {t.status === "active" ? "Activo" : 
                     t.status === "suspended" ? "Suspendido" : 
                     t.status === "onboarding" ? "Onboarding" : t.status}
                  </StatusPill>
                </TableCell>
                <TableCell className="tabular-nums">{t.analytics.views}</TableCell>
                <TableCell className="tabular-nums">{t.analytics.appointmentConfirmed}</TableCell>
                <TableCell className="tabular-nums">{t.analytics.viewToConfirmationRate}%</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant={t.status === "active" ? "secondary" : "primary"}
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggle(t.id, t.status)}
                  >
                    {t.status === "active" ? "Suspender" : "Suscribir/Activar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-on-surface-variant py-8">
                  No hay locales registrados aún.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
