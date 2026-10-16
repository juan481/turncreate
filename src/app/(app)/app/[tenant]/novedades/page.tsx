import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { requireTenantPage } from "@/server/firebase/tenant-page";

// Props tipadas a mano (no PageProps<"/app/[tenant]/novedades">): la ruta
// es nueva y el tipo global recién existe después de `next typegen`.
export default async function NovedadesPage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const { tenant } = await requireTenantPage(slug);

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div className="hidden lg:block">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Novedades</h1>
      </div>
      <Card hoverLift={false} className="p-lg">
        <EmptyState
          icon={<Icon name="newspaper" />}
          title="Próximamente…"
          description="Acá vas a ver todo lo nuevo de TurnCreate: funciones recién salidas, mejoras y tips para sacarle más jugo a tu turnero. Estamos armando la primera tanda."
          action={
            <Link href={`/app/${tenant.slug}`} className={buttonVariants({ variant: "secondary", className: "mt-2" })}>
              Volver al inicio
            </Link>
          }
        />
      </Card>
    </div>
  );
}
