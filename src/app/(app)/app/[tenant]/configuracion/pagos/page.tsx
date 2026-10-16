import { redirect } from "next/navigation";
import { requireTenantPage } from "@/server/firebase/tenant-page";

// Puente hasta que exista la pantalla "Pagos y señas": el callback de
// Mercado Pago vuelve acá y se reenvía a Configuración con el resultado.
export default async function PagosPage({ params, searchParams }: PageProps<"/app/[tenant]/configuracion/pagos">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const mp = (await searchParams).mp;
  const result = typeof mp === "string" && /^[a-z]+$/.test(mp) ? `?mp=${mp}` : "";
  redirect(`/app/${tenant.slug}/configuracion${result}`);
}
