import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { firebaseAdmin } from "@/server/firebase/admin";
import { TenantsClient } from "./tenants-client";

export default async function PlatformDashboardPage() {
  const snapshot = await firebaseAdmin().db.collection("tenants").orderBy("createdAt", "desc").get();
  const tenantsList = snapshot.docs.map((doc) => ({ id: doc.id, name: String(doc.data().name ?? ""), slug: String(doc.data().slug ?? ""), status: String(doc.data().status ?? "trial"), created_at: doc.data().createdAt?.toDate?.().toISOString?.() ?? "" }));
  const activeTenants = tenantsList.filter(t => t.status === "active").length;
  // Simulated MRR: Active tenants * 50
  const mrr = activeTenants * 50;

  const METRICAS = [
    { label: "Locales activos", value: activeTenants.toString(), icon: "storefront" },
    { label: "MRR", value: `$${mrr.toFixed(2)}`, icon: "trending_up" },
    { label: "Locales totales", value: tenantsList.length.toString(), icon: "apartment" },
    { label: "Turnos totales", value: "—", icon: "event" },
  ];

  return (
    <div className="space-y-lg">
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface sm:font-headline-lg sm:text-headline-lg">
        Dashboard de Plataforma
      </h1>

      <div className="grid gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {METRICAS.map((m) => (
          <Card key={m.label} hoverLift={false} className="flex flex-col gap-md p-lg">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
                <Icon name={m.icon} className="text-[16px]" />
              </span>
              <p className="font-label-sm text-label-sm text-on-surface-variant">{m.label}</p>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">{m.value}</p>
          </Card>
        ))}
      </div>

      <TenantsClient tenants={tenantsList} />
    </div>
  );
}
