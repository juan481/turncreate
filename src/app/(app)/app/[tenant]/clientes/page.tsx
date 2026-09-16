import { Card } from "@/components/ui/card";

export default function ClientesPage() {
  return (
    <Card className="space-y-1 p-lg">
      <h1 className="font-headline-sm text-headline-sm text-on-surface">
        Clientes
      </h1>
      {/* TODO Fase 1: listado real (clients) con notas y client_stats */}
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        CRM de clientes con notas y estadísticas — Fase 1 del plan.
      </p>
    </Card>
  );
}
