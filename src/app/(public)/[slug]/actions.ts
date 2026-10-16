"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase, type TenantRecord } from "@/server/firebase/tenants";
import {
  getEligibleStaffIds,
  getServiceRecord,
  listAvailableStarts,
  occupancyDocId,
  occupancySlotInstants,
} from "@/server/firebase/booking";
import { createCheckoutPreference, publicCheckoutQuote } from "@/server/mercadopago/checkout";
import { getMpConnection } from "@/server/mercadopago/connections";
import { addDaysISO, toDateISOInTz, todayISO } from "@/lib/dates";
import { getPublicServiceCatalog } from "@/server/services/catalog";
import { planFeatures } from "@/lib/plans";
import { assertPublicBookingRate } from "@/server/public-booking/rate-limit";
import type { ClientFormData, PublicCategory, PublicHold, PublicStaffMember, PublicTenant } from "./types";

async function getTenantRecordById(tenantId: string): Promise<TenantRecord> {
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  if (!doc.exists) throw new Error("Turnero inexistente");
  const tenant = doc.data() as TenantRecord;
  if (tenant.status === "suspended") throw new Error("Este turnero no esta disponible");
  return tenant;
}

function assertBookableDate(dateISO: string, tenant: TenantRecord) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("Fecha invalida");
  const first = todayISO(tenant.timezone);
  const last = addDaysISO(first, tenant.settings.maxBookingDays ?? 60);
  if (dateISO < first || dateISO > last) throw new Error("La fecha esta fuera del periodo habilitado");
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
    booking_enabled: tenant.status !== "suspended" && tenant.settings.publicBookingEnabled !== false && connection?.status === "connected" && tenant.settings.depositType !== "none" && tenant.settings.payments?.mercadopagoEnabled !== false,
    books_by_staff: tenant.settings.booksByStaff && planFeatures(tenant).maxStaff > 1,
    max_booking_days: tenant.settings.maxBookingDays ?? 60,
    description: tenant.description ?? null,
    address: tenant.address ?? null,
    instagram_url: tenant.instagramUrl ?? null,
    whatsapp_number: tenant.whatsappNumber ?? null,
  };
}

export async function getPublicCatalog(tenantId: string): Promise<PublicCategory[]> {
  return getPublicServiceCatalog(tenantId);
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
  void timezone;
  void allStaffIds;
  assertBookableDate(dateISO, tenant);
  const service = await getServiceRecord(tenantId, serviceId);
  if (!service.active || !service.public) throw new Error("El servicio no está disponible para reservas online");
  const eligibleStaffIds = await getEligibleStaffIds(tenantId, serviceId);
  if (staffId !== "any" && !eligibleStaffIds.includes(staffId)) throw new Error("Profesional no disponible para este servicio");
  const starts = await listAvailableStarts({ tenantId, tenant, serviceId, staffId, dateISO, timezone: tenant.timezone });
  return starts.map((date) => date.toISOString());
}

export async function createHold(tenantId: string, serviceId: string, staffId: string | "any", allStaffIds: string[], startsAtISO: string, _dateISO: string, _timezone: string): Promise<PublicHold> {
  void allStaffIds;
  void _dateISO;
  void _timezone;
  const db = firebaseAdmin().db;
  const tenant = await getTenantRecordById(tenantId);
  const connection = await getMpConnection(tenantId);
  if (tenant.settings.publicBookingEnabled === false || connection?.status !== "connected" || tenant.settings.depositType === "none" || tenant.settings.payments?.mercadopagoEnabled === false) {
    throw new Error("Las reservas online todavia no estan habilitadas");
  }
  // Cada hold bloquea el horario 10'; una clienta real hace 1 o 2.
  await assertPublicBookingRate(tenantId, "hold", 8);
  const tenantRef = db.collection("tenants").doc(tenantId);
  const service = await getServiceRecord(tenantId, serviceId);
  if (!service.active || !service.public) throw new Error("El servicio no está disponible para reservas online");
  const start = new Date(startsAtISO);
  if (Number.isNaN(start.getTime())) throw new Error("Horario invalido");
  const dateISO = toDateISOInTz(start, tenant.timezone);
  assertBookableDate(dateISO, tenant);
  const end = new Date(start.getTime() + service.durationMin * 60_000);
  const eligibleStaffIds = await getEligibleStaffIds(tenantId, serviceId);
  if (staffId !== "any" && !eligibleStaffIds.includes(staffId)) throw new Error("Profesional no disponible para este servicio");
  const candidates = staffId === "any" ? eligibleStaffIds : [staffId];
  const availability = await Promise.all(candidates.map(async (candidate) => {
    const starts = await listAvailableStarts({
      tenantId,
      tenant,
      serviceId,
      staffId: candidate,
      dateISO,
      timezone: tenant.timezone,
    });
    return starts.some((slot) => slot.getTime() === start.getTime()) ? candidate : null;
  }));
  const staffIds = availability.filter((candidate): candidate is string => candidate !== null);
  if (staffIds.length === 0) throw new Error("Ese horario ya no esta disponible");
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
    if (!selected) throw new Error("Ese horario ya no está disponible");
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
