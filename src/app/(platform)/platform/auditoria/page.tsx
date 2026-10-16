import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { isPlatformAdmin } from "@/server/platform";
import { getRecentAudit } from "@/server/platform/audit";
import { AuditList } from "../audit-list";

const LIMIT = 100;

export default async function PlatformAuditPage() {
  // Chequeo propio: el notFound() del layout no frena el payload RSC de la página.
  if (!(await isPlatformAdmin())) notFound();
  const entries = await getRecentAudit(LIMIT);

  return (
    <div className="space-y-lg">
      <div className="min-w-0">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
          Auditoría
        </h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Los últimos {LIMIT} cambios hechos desde esta consola: locales y turneros apagados o prendidos, con el motivo.
        </p>
      </div>
      <Card hoverLift={false} className="min-w-0 p-lg">
        <AuditList entries={entries} showTenant />
      </Card>
    </div>
  );
}
