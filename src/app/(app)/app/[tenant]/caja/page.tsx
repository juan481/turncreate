import { Card } from "@/components/ui/card";

export default function CajaPage() {
  return (
    <Card className="space-y-1 p-lg">
      <h1 className="font-headline-sm text-headline-sm text-on-surface">
        Caja
      </h1>
      {/* TODO Fase 5: apertura/cierre de caja, cobro mixto, comisiones */}
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Arqueo, cobro mixto y comisiones — Fase 5 del plan.
      </p>
    </Card>
  );
}
