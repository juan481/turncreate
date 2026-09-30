"use server";
import { endOfMonth, startOfMonth } from "date-fns";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
export async function exportarTurnosCsv(tenantSlug: string, monthISO: string) {
  const user = await getCurrentFirebaseUser(); if (!user) throw new Error("No autorizado"); const { tenant } = await requireTenantAccess(user.uid, tenantSlug);
  const month = new Date(`${monthISO}-01T12:00:00`); const docs = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments").where("startsAt", ">=", startOfMonth(month)).where("startsAt", "<=", endOfMonth(month)).orderBy("startsAt").get();
  const labels: Record<string, string> = { pending_payment: "Pendiente de pago", confirmed: "Confirmado", completed: "Completado", no_show: "No vino", cancelled: "Cancelado", expired: "Vencido" }; const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = docs.docs.map((doc) => { const item = doc.data(); return [quote(item.startsAt?.toDate?.().toLocaleString("es-AR") ?? ""), quote(String(item.clientName ?? "")), quote((item.items ?? []).map((service: { name?: string }) => service.name ?? "").join(" + ")), quote(labels[String(item.status)] ?? String(item.status)), Number(item.total ?? 0).toFixed(2)].join(","); });
  return { filename: `turnos-${tenantSlug}-${monthISO}.csv`, content: `Fecha,Cliente,Servicio,Estado,Monto\n${rows.join("\n")}` };
}
