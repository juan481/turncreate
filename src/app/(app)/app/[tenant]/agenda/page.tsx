import { Card } from "@/components/ui/card";

export default function AgendaPage() {
  return (
    <Card className="space-y-1 p-lg">
      <h1 className="font-headline-sm text-headline-sm text-on-surface">
        Agenda
      </h1>
      {/* TODO Fase 1: motor de disponibilidad + grilla CSS Grid / dnd-kit */}
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Grilla por profesional con drag & drop — Fase 1 del plan.
      </p>
    </Card>
  );
}
