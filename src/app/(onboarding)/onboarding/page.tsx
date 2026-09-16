import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function OnboardingPage() {
  return (
    <Card className="space-y-lg">
      <div className="space-y-1">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Contanos de tu local
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Con esto armamos tu turnero público.
        </p>
      </div>

      {/* TODO Fase 4: wizard real (rubro -> service_templates, slug, horarios) */}
      <div className="space-y-md">
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Nombre del local
          </label>
          <Input placeholder="Studio Lumière" disabled />
        </div>
        <Button className="w-full" disabled>
          Continuar
        </Button>
      </div>
    </Card>
  );
}
