import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import type { AppNotification } from "@/lib/app-notification";
import { firebaseAdmin } from "./admin";

const WINDOW_HOURS = 48;

function servicesOf(data: FirebaseFirestore.DocumentData) {
  if (Array.isArray(data.items)) {
    const names = data.items.map((item: { name?: unknown }) => typeof item.name === "string" ? item.name : "").filter(Boolean);
    if (names.length > 0) return names.join(" + ");
  }
  return typeof data.serviceName === "string" && data.serviceName ? data.serviceName : "Turno";
}

export async function listAppNotifications(tenantId: string, tenantSlug: string): Promise<AppNotification[]> {
  const since = Timestamp.fromMillis(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  const snapshot = await firebaseAdmin().db
    .collection("tenants")
    .doc(tenantId)
    .collection("appointments")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .limit(40)
    .select("createdAt", "status", "awaitingTransfer", "clientName", "items", "serviceName")
    .get();

  return snapshot.docs.flatMap((doc) => {
    const data = doc.data();
    if (["cancelled", "expired"].includes(String(data.status))) return [];
    const at = data.createdAt?.toDate?.();
    if (!(at instanceof Date)) return [];
    const transfer = data.status === "pending_payment" && data.awaitingTransfer === true;
    const client = typeof data.clientName === "string" && data.clientName ? data.clientName : "Cliente sin nombre";
    return [{
      id: `${transfer ? "transfer" : "appointment"}:${doc.id}`,
      icon: transfer ? "account_balance" : "event_available",
      color: transfer ? "#b75d00" : "#157a55",
      title: transfer ? "Transferencia por confirmar" : "Nuevo turno",
      detail: `${client} · ${servicesOf(data)}`,
      at: at.toISOString(),
      href: transfer ? `/app/${tenantSlug}/transferencias` : `/app/${tenantSlug}/agenda/${doc.id}`,
    }];
  });
}
