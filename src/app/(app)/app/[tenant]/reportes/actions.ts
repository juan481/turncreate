"use server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { formatInTz, monthRange } from "@/lib/dates";
export async function exportarTurnosCsv(tenantSlug: string, monthISO: string) {
  const user = await getCurrentFirebaseUser(); if (!user) throw new Error("No autorizado"); const { tenant } = await requireTenantAccess(user.uid, tenantSlug, { write: false });
  const { start, end } = monthRange(`${monthISO}-01`, tenant.timezone);
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments").where("startsAt", ">=", start).where("startsAt", "<", end).orderBy("startsAt").get();
  const labels: Record<string, string> = { pending_payment: "Pendiente de pago", confirmed: "Confirmado", completed: "Completado", no_show: "No vino", cancelled: "Cancelado", expired: "Vencido" }; const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = docs.docs.map((doc) => { const item = doc.data(); const instant = item.startsAt?.toDate?.(); return [quote(instant ? formatInTz(instant, tenant.timezone, { dateStyle: "short", timeStyle: "short" }) : ""), quote(String(item.clientName ?? "")), quote((item.items ?? []).map((service: { name?: string }) => service.name ?? "").join(" + ")), quote(labels[String(item.status)] ?? String(item.status)), Number(item.total ?? 0).toFixed(2)].join(","); });
  return { filename: `turnos-${tenantSlug}-${monthISO}.csv`, content: `Fecha,Cliente,Servicio,Estado,Monto\n${rows.join("\n")}` };
}
