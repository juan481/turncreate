import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getPaymentBreakdown } from "@/server/firebase/stats";
import { dayRange, todayISO } from "@/lib/dates";
import { planFeatures } from "@/lib/plans";
import { CajaClient } from "./caja-client";

export default async function CajaPage({ params }: PageProps<"/app/[tenant]/caja">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const { db } = firebaseAdmin();
  const ref = db.collection("tenants").doc(tenant.id);
  const range = dayRange(todayISO(tenant.timezone), tenant.timezone);
  const features = planFeatures(tenant);
  const [sessions, appointments, products, paymentBreakdown] = await Promise.all([
    features.cashSessions ? ref.collection("cashSessions").orderBy("openedAt", "desc").get() : null,
    ref.collection("appointments").where("startsAt", ">=", range.start).where("startsAt", "<", range.end).orderBy("startsAt").get(),
    ref.collection("products").where("active", "==", true).get(),
    getPaymentBreakdown(tenant.id, range),
  ]);

  const open = sessions?.docs.find((doc) => !doc.data().closedAt);
  const movements = open ? await open.ref.collection("movements").orderBy("createdAt", "desc").get() : null;
  const lastClosed = sessions?.docs.find((doc) => doc.data().closedAt)?.data();
  const activeStatuses = new Set(["confirmed", "completed", "pending_payment"]);
  const paymentsByMethod = Object.fromEntries(
    Object.entries(paymentBreakdown.byMethod).map(([method, totals]) => [method, totals.gross]),
  );

  return (
    <CajaClient
      cashSessionsEnabled={features.cashSessions}
      tenantSlug={tenantSlug}
      timezone={tenant.timezone}
      session={open ? {
        id: open.id,
        opened_at: open.data().openedAt?.toDate?.().toISOString?.() ?? new Date().toISOString(),
        opening_amount: Number(open.data().openingAmount ?? 0),
      } : null}
      appointments={appointments.docs
        .filter((doc) => activeStatuses.has(String(doc.data().status)))
        .map((doc) => {
          const item = doc.data();
          return {
            id: doc.id,
            startsAt: item.startsAt?.toDate?.().toISOString?.() ?? "",
            total: Number(item.total ?? 0),
            balance: Number(item.balance ?? 0),
            clientName: String(item.clientName ?? ""),
            staffName: String(item.staffName ?? ""),
            serviceNames: Array.isArray(item.items)
              ? item.items.map((service: { name?: string }) => service.name ?? "").join(", ")
              : String(item.serviceName ?? ""),
          };
        })
        .filter((item) => item.balance > 0 && item.startsAt)}
      products={products.docs.map((doc) => ({ id: doc.id, name: String(doc.data().name ?? ""), price: Number(doc.data().price ?? 0) }))}
      movements={movements?.docs.map((doc) => ({
        id: doc.id,
        type: String(doc.data().type),
        amount: Number(doc.data().amount),
        reason: String(doc.data().reason ?? ""),
        createdAt: doc.data().createdAt?.toDate?.().toISOString?.() ?? "",
      })) ?? []}
      lastClosedSession={lastClosed ? {
        closedAt: lastClosed.closedAt?.toDate?.().toISOString?.() ?? "",
        expectedAmount: Number(lastClosed.expectedAmount ?? 0),
        countedAmount: Number(lastClosed.countedAmount ?? 0),
        difference: Number(lastClosed.difference ?? 0),
      } : null}
      paymentsByMethod={paymentsByMethod}
    />
  );
}
