import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/server/supabase/admin";
import { TenantsClient } from "./tenants-client";

export default async function PlatformDashboardPage() {
  const supabase = createAdminClient();
  
  // Fetch tenants bypassing RLS
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tenants:", error);
  }

  const tenantsList = tenants || [];
  const activeTenants = tenantsList.filter(t => t.status === "active").length;
  // Simulated MRR: Active tenants * 50
  const mrr = activeTenants * 50;

  const METRICAS = [
    { label: "Locales activos", value: activeTenants.toString() },
    { label: "MRR", value: `$${mrr.toFixed(2)}` },
    { label: "Locales totales", value: tenantsList.length.toString() },
    { label: "Turnos totales", value: "—" }, // Still simulated
  ];

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
        Dashboard de Plataforma
      </h1>
      
      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {METRICAS.map((m) => (
          <Card key={m.label} className="p-lg">
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {m.label}
            </p>
            <p className="mt-2 font-headline-lg text-headline-lg text-on-surface">
              {m.value}
            </p>
          </Card>
        ))}
      </div>

      <TenantsClient tenants={tenantsList} />
    </div>
  );
}
