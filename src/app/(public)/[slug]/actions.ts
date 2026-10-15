"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase, type TenantRecord } from "@/server/firebase/tenants";
import { getServiceRecord, listAvailableStarts, occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { createCheckoutPreference, publicCheckoutQuote } from "@/server/mercadopago/checkout";
import { getMpConnection } from "@/server/mercadopago/connections";
import type { ClientFormData, PublicCategory, PublicHold, PublicStaffMember, PublicTenant } from "./types";

async function getTenantRecordById(tenantId: string): Promise<TenantRecord> {
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  return doc.data() as TenantRecord;
}

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return null;
  const connection = await getMpConnection(tenant.id);
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logo_url: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null,
    timezone: tenant.timezone,
    booking_enabled: connection?.status === "connected" && tenant.settings.depositType !== "none",
  };
}

export async function getPublicCatalog(tenantId: string): Promise<PublicCategory[]> {
  const db = firebaseAdmin().db;
  const [services, categories] = await Promise.all([
    db.collection("tenants").doc(tenantId).collection("services").where("active", "==", true).get(),
    db.collection("tenants").doc(tenantId).collection("serviceCategories").orderBy("order", "asc").get(),
  ]);
  const categoryNames = new Map(categories.docs.map((doc) => [doc.id, String(doc.data().name)]));
  const grouped = new Map<string, PublicCategory>();
  for (const doc of services.docs) {
    const data = doc.data();
    if (data.archivedAt || data.public === false) continue;
    const categoryId = String(data.categoryId ?? "services");
    if (!grouped.has(categoryId)) grouped.set(categoryId, { id: categoryId, name: categoryNames.get(categoryId) ?? String(data.categoryName ?? "Servicios"), services: [] });
    grouped.get(categoryId)!.services.push({
      id: doc.id,
      name: String(data.name),
      description: data.description ? String(data.description) : null,
      price: Number(data.price),
      duration: (data.phases ?? []).reduce((sum: number, phase: { minutes?: number }) => sum + Number(phase.minutes ?? 0), Number(data.bufferAfterMin ?? 0)),
    });
  }
  return Array.from(grouped.values());
}

export async function getPublicStaff(tenantId: string): Promise<PublicStaffMember[]> {
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return docs.docs.map((doc) => ({ id: doc.id, name: String(doc.data().displayName), photo_url: (doc.data().photoUrl as string | null) ?? null }));
}

export async function getPublicStaffForService(tenantId: string, serviceId: string): Promise<PublicStaffMember[]> {
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return docs.docs
    .filter((doc) => (doc.data().serviceIds ?? []).includes(serviceId))
    .map((doc) => ({ id: doc.id, name: String(doc.data().displayName), photo_url: (doc.data().photoUrl as string | null) ?? null }));
}

export async function getAvailableSlots(tenantId: string, serviceId: string, staffId: string | "any", dateISO: string, timezone: string, allStaffIds: string[]): Promise<string[]> {
  const tenant = await getTenantRecordById(tenantId);
  const starts = await listAvailableStarts({ tenantId, tenant, serviceId, staffId: staffId === "any" && allStaffIds.length === 0 ? "any" : staffId, dateISO, timezone });
  return starts.map((date) => date.toISOString());
}

export async function createHold(tenantId: string, serviceId: string, staffId: string | "any", allStaffIds: string[], startsAtISO: string, _dateISO: string, _timezone: string): Promise<PublicHold> {
  void _dateISO;
  void _timezone;
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(tenantId);
  const service = await getServiceRecord(tenantId, serviceId);
  const start = new Date(startsAtISO);
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const staffIds = staffId === "any" ? allStaffIds : [staffId];
  const holdRef = tenantRef.collection("holds").doc();
  let selected = "";
  await db.runTransaction(async (transaction) => {
    for (const candidate of staffIds) {
      const slots = occupancySlotInstants(start, service.durationMin).map((instant) => tenantRef.collection("occupancy").doc(occupancyDocId(candidate, instant)));
      const existing = await transaction.getAll(...slots);
      if (existing.some((doc) => doc.exists && (!doc.data()?.expiresAt || doc.data()?.expiresAt.toDate() > new Date()))) continue;
      selected = candidate;
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60_000));
      slots.forEach((slot) => transaction.set(slot, { holdId: holdRef.id, tenantId, expiresAt }));
      transaction.create(holdRef, { id: holdRef.id, tenantId, staffId: selected, serviceId, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), expiresAt, createdAt: FieldValue.serverTimestamp() });
      break;
    }
    if (!selected) throw new Error("Ese horario ya no estÃ¡ disponible");
  });
  const hold = (await holdRef.get()).data()!;
  return { id: holdRef.id, tenant_id: tenantId, staff_id: selected, starts_at: hold.startsAt.toDate().toISOString(), ends_at: hold.endsAt.toDate().toISOString(), expires_at: hold.expiresAt.toDate().toISOString() };
}

export async function startPublicCheckout(slug: string, holdId: string, client: ClientFormData) {
  return createCheckoutPreference({ slug, holdId, client });
}

export async function getPublicCheckoutQuote(tenantId: string, serviceId: string) {
  return publicCheckoutQuote(tenantId, serviceId);
}
