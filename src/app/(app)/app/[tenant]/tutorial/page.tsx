import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { requireTenantPage } from "@/server/firebase/tenant-page";

// Props tipadas a mano (no PageProps<"/app/[tenant]/tutorial">): la ruta
// es nueva y el tipo global recién existe después de `next typegen`.
export default async function TutorialPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantPage(slug);

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div className="hidden lg:block">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Cómo funciona</h1>
      </div>
      <Card hoverLift={false} className="p-lg">
        <EmptyState
          icon={<Icon name="play_circle" />}
          title="Próximamente…"
          description="Estamos grabando videos cortitos para que aprendas a usar TurnCreate en un par de minutos: agendar, cobrar, compartir tu link y más. Mientras tanto, en Ayuda tenés las dudas más comunes resueltas."
          action={
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <Link href={`/app/${tenant.slug}/ayuda`} className={buttonVariants()}>
                <Icon name="help" className="text-[18px]" />
                Ir a Ayuda
              </Link>
              <Link href={`/app/${tenant.slug}`} className={buttonVariants({ variant: "secondary" })}>
                Volver al inicio
              </Link>
            </div>
          }
        />
      </Card>
    </div>
  );
}
