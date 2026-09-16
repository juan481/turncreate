import { Card } from "@/components/ui/card";

const METRICAS = [
  { label: "Locales activos", value: "—" },
  { label: "MRR", value: "—" },
  { label: "Altas del mes", value: "—" },
  { label: "Turnos totales", value: "—" },
];

export default function PlatformDashboardPage() {
  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
        Dashboard
      </h1>
      {/* TODO Fase 4/6: métricas reales (locales por estado, MRR, altas, bajas) */}
      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {METRICAS.map((m) => (
          <Card key={m.label} className="p-lg">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {m.label}
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {m.value}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
