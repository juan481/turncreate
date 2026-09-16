import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";

export default async function PublicBookingPage({
  params,
}: PageProps<"/[slug]">) {
  const { slug } = await params;

  return (
    <div className="space-y-lg">
      <div className="space-y-2">
        <StatusPill status="pending">Paso 1 de 4 · Servicio</StatusPill>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Elegí tu tratamiento o servicio
        </h1>
      </div>

      {/* TODO Fase 2: listar servicios reales via public_catalog(slug) */}
      <Card className="space-y-1 p-lg">
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Turnero de <strong>{slug}</strong> — el catálogo de servicios y el
          motor de disponibilidad se conectan en la Fase 2 del plan.
        </p>
      </Card>
    </div>
  );
}
