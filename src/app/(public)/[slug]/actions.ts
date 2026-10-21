"use server";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase, type TenantRecord } from "@/server/firebase/tenants";
import {
  getEligibleStaffIds,
  getServiceRecord,
  listAvailableStarts,
  listSlotAvailability,
  occupancyDocId,
  occupancySlotInstants,
} from "@/server/firebase/booking";
import { createCheckoutPreference, publicCheckoutQuote } from "@/server/mercadopago/checkout";
import { getMpConnection } from "@/server/mercadopago/connections";
import { addDaysISO, formatInTz, toDateISOInTz, todayISO } from "@/lib/dates";
import { getPublicServiceCatalog } from "@/server/services/catalog";
import { planFeatures } from "@/lib/plans";
import { normalizeBrandColor } from "@/lib/brand-theme";
import { tenantBillingAllowsPublicBooking } from "@/server/billing/tenant-billing";
import { assertPublicBookingRate } from "@/server/public-booking/rate-limit";
import {
  bookingAvailability,
  isTransferReady,
  PUBLIC_HOLD_MINUTES,
  TRANSFER_MIN_LEAD_HOURS,
  transferSlotOfferable,
  type BookingAvailability,
} from "@/server/public-booking/payment-methods";
import { createTransferAppointment, getTransferInstructions } from "@/server/public-booking/transfer";
import { buildTransferPanel } from "./transfer-panel";
import { DEFAULT_CANCELLATION_REFUND_HOURS, normalizeCancellationRefundHours } from "@/domain/booking/cancellation-policy";
import { sendAppointmentManagementLink } from "@/server/email";
import { publicAppUrl } from "@/server/mercadopago/config";
import type {
  ClientFormData,
  PublicActionResult,
  PublicCategory,
  PublicHold,
  PublicSlot,
  PublicStaffMember,
  PublicTenant,
  TransferPanelData,
} from "./types";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function fail(error: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: error instanceof Error && error.message ? error.message : fallback };
}

async function getTenantRecordById(tenantId: string): Promise<TenantRecord> {
  if (typeof tenantId !== "string" || !ID_PATTERN.test(tenantId)) throw new Error("Turnero inexistente");
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  if (!doc.exists) throw new Error("Turnero inexistente");
  const tenant = doc.data() as TenantRecord;
  if (tenant.status === "suspended") throw new Error("Este turnero no esta disponible");
  return tenant;
}

/** Medios de pago habilitados + si el turnero toma reservas (mismo criterio en todas las acciones). */
async function tenantBooking(tenant: TenantRecord): Promise<BookingAvailability & { open: boolean }> {
  // Sin transferencia lista, la conexión de MP es lo único que decide; con
  // transferencia lista igual hace falta saber si MP también está.
  const connection = await getMpConnection(tenant.id);
  const availability = bookingAvailability(tenant, connection?.status === "connected");
  // Interrumpido por falta de pago: booking_enabled false → la página muestra "no disponible".
  const open = tenant.status !== "suspended" && tenant.settings.publicBookingEnabled !== false && availability.enabled && tenantBillingAllowsPublicBooking(tenant);
  return { ...availability, open };
}

function assertBookableDate(dateISO: string, tenant: TenantRecord) {
  if (typeof dateISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("Fecha invalida");
  const first = todayISO(tenant.timezone);
  const last = addDaysISO(first, tenant.settings.maxBookingDays ?? 60);
  if (dateISO < first || dateISO > last) throw new Error("La fecha esta fuera del periodo habilitado");
}

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) return null;
  const booking = await tenantBooking(tenant);
  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    logo_url: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null,
    timezone: tenant.timezone,
    booking_enabled: booking.open,
    payment_methods: booking.open ? booking.methods : { mercadopago: false, transfer: false },
    books_by_staff: tenant.settings.booksByStaff && planFeatures(tenant).maxStaff > 1,
    max_booking_days: tenant.settings.maxBookingDays ?? 60,
    cancellation_refund_hours: normalizeCancellationRefundHours(tenant.settings.cancellationRefundHours ?? DEFAULT_CANCELLATION_REFUND_HOURS),
    slot_interval_min: tenant.settings.slotIntervalMin ?? 15,
    bookable_weekdays: [...new Set((tenant.businessHours ?? []).map((hours) => hours.weekday))],
    description: tenant.description ?? null,
    address: tenant.address ?? null,
    instagram_url: tenant.instagramUrl ?? null,
    whatsapp_number: tenant.whatsappNumber ?? null,
    brand_color: normalizeBrandColor(tenant.brandColor),
  };
}

export async function getPublicCatalog(tenantId: string): Promise<PublicCategory[]> {
  await getTenantRecordById(tenantId);
  return getPublicServiceCatalog(tenantId);
}

export async function getPublicStaff(tenantId: string): Promise<PublicStaffMember[]> {
  await getTenantRecordById(tenantId);
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return docs.docs.map((doc) => ({ id: doc.id, name: String(doc.data().displayName), photo_url: (doc.data().photoUrl as string | null) ?? null }));
}

export async function getPublicStaffForService(tenantId: string, serviceId: string): Promise<PublicStaffMember[]> {
  await getTenantRecordById(tenantId);
  if (typeof serviceId !== "string" || !ID_PATTERN.test(serviceId)) return [];
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return docs.docs
    .filter((doc) => (doc.data().serviceIds ?? []).includes(serviceId))
    .map((doc) => ({ id: doc.id, name: String(doc.data().displayName), photo_url: (doc.data().photoUrl as string | null) ?? null }));
}

export async function getAvailableSlots(tenantId: string, serviceId: string, staffId: string | "any", dateISO: string, timezone: string, allStaffIds: string[]): Promise<string[]> {
  const tenant = await getTenantRecordById(tenantId);
  if (!tenantBillingAllowsPublicBooking(tenant)) throw new Error("Este turnero no está disponible");
  void timezone;
  void allStaffIds;
  assertBookableDate(dateISO, tenant);
  if (typeof serviceId !== "string" || !ID_PATTERN.test(serviceId)) throw new Error("Servicio invalido");
  const service = await getServiceRecord(tenantId, serviceId);
  if (!service.active || !service.public) throw new Error("El servicio no está disponible para reservas online");
  const eligibleStaffIds = await getEligibleStaffIds(tenantId, serviceId);
  if (staffId !== "any" && !eligibleStaffIds.includes(staffId)) throw new Error("Profesional no disponible para este servicio");
  const starts = await listAvailableStarts({ tenantId, tenant, serviceId, staffId, dateISO, timezone: tenant.timezone });
  // Si la seña solo se puede pagar por transferencia, no se ofrecen los
  // horarios demasiado cercanos (no hay tiempo de esperar el comprobante).
  // Mismo margen que al tomar el horario: anticipación mínima + lo que dura
  // el hold, así no se ofrece uno que createTransferAppointment rechazaría.
  if (isTransferReady(tenant.settings.payments?.transfer)) {
    const booking = await tenantBooking(tenant);
    if (!booking.methods.mercadopago) {
      const now = new Date();
      return starts.filter((date) => transferSlotOfferable(date, now)).map((date) => date.toISOString());
    }
  }
  return starts.map((date) => date.toISOString());
}

export async function getPublicDaySlots(tenantId: string, serviceId: string, staffId: string | "any", dateISO: string): Promise<PublicSlot[]> {
  const tenant = await getTenantRecordById(tenantId);
  if (!tenantBillingAllowsPublicBooking(tenant)) throw new Error("Este turnero no está disponible");
  assertBookableDate(dateISO, tenant);
  if (typeof serviceId !== "string" || !ID_PATTERN.test(serviceId)) throw new Error("Servicio inválido");
  const service = await getServiceRecord(tenantId, serviceId);
  if (!service.active || !service.public) throw new Error("El servicio no está disponible para reservas online");
  const eligibleStaffIds = await getEligibleStaffIds(tenantId, serviceId);
  if (staffId !== "any" && !eligibleStaffIds.includes(staffId)) throw new Error("Profesional no disponible para este servicio");
  let slots = await listSlotAvailability({ tenantId, tenant, serviceId, staffId, dateISO, timezone: tenant.timezone });
  if (isTransferReady(tenant.settings.payments?.transfer)) {
    const booking = await tenantBooking(tenant);
    if (!booking.methods.mercadopago) slots = slots.filter((slot) => transferSlotOfferable(slot.startsAt));
  }
  return slots.map((slot) => ({ starts_at: slot.startsAt.toISOString(), available: slot.available }));
}

async function holdSlot(tenantId: string, serviceId: string, staffId: string | "any", startsAtISO: string): Promise<PublicHold> {
  const db = firebaseAdmin().db;
  const tenant = await getTenantRecordById(tenantId);
  const booking = await tenantBooking(tenant);
  if (!booking.open) throw new Error("Las reservas online todavia no estan habilitadas");
  // Cada hold bloquea el horario 10'; una clienta real hace 1 o 2.
  await assertPublicBookingRate(tenantId, "hold", 8);
  if (typeof serviceId !== "string" || !ID_PATTERN.test(serviceId)) throw new Error("El servicio no está disponible para reservas online");
  if (typeof staffId !== "string" || (staffId !== "any" && !ID_PATTERN.test(staffId))) throw new Error("Profesional no disponible para este servicio");
  const tenantRef = db.collection("tenants").doc(tenantId);
  const service = await getServiceRecord(tenantId, serviceId);
  if (!service.active || !service.public) throw new Error("El servicio no está disponible para reservas online");
  const start = new Date(typeof startsAtISO === "string" ? startsAtISO : "");
  if (Number.isNaN(start.getTime())) throw new Error("Horario invalido");
  if (!booking.methods.mercadopago && !transferSlotOfferable(start)) {
    throw new Error(`Ese horario está muy cerca: para pagar la seña por transferencia elegí uno con al menos ${TRANSFER_MIN_LEAD_HOURS} h de anticipación.`);
  }
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
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + PUBLIC_HOLD_MINUTES * 60_000));
      slots.forEach((slot) => transaction.set(slot, { holdId: holdRef.id, tenantId, expiresAt }));
      transaction.create(holdRef, { id: holdRef.id, tenantId, staffId: selected, serviceId, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), expiresAt, createdAt: FieldValue.serverTimestamp() });
      break;
    }
    if (!selected) throw new Error("Ese horario ya no está disponible");
  });
  const hold = (await holdRef.get()).data()!;
  return { id: holdRef.id, tenant_id: tenantId, staff_id: selected, starts_at: hold.startsAt.toDate().toISOString(), ends_at: hold.endsAt.toDate().toISOString(), expires_at: hold.expiresAt.toDate().toISOString() };
}

export async function createHold(tenantId: string, serviceId: string, staffId: string | "any", allStaffIds: string[], startsAtISO: string, _dateISO: string, _timezone: string): Promise<PublicActionResult<PublicHold>> {
  void allStaffIds;
  void _dateISO;
  void _timezone;
  try {
    return { ok: true, data: await holdSlot(tenantId, serviceId, staffId, startsAtISO) };
  } catch (error) {
    return fail(error, "No pudimos reservar ese horario. Intentá de nuevo.");
  }
}

export async function startPublicCheckout(slug: string, holdId: string, client: ClientFormData): Promise<PublicActionResult<{ init_point: string }>> {
  try {
    const result = await createCheckoutPreference({ slug, holdId, client });
    return { ok: true, data: { init_point: result.init_point } };
  } catch (error) {
    return fail(error, "No pudimos iniciar el pago. Elegí el horario nuevamente.");
  }
}

/**
 * Reserva con seña por transferencia: el turno queda tomado (pendiente) y
 * la clienta recibe los datos para transferir. El monto sale del servicio
 * en el server, nunca de lo que mande el navegador.
 */
export async function startTransferBooking(slug: string, holdId: string, client: ClientFormData): Promise<PublicActionResult<TransferPanelData>> {
  try {
    if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) throw new Error("Este turnero no está disponible");
    const tenant = await getTenantBySlugFromFirebase(slug);
    if (!tenant) throw new Error("Este turnero no está disponible");
    // Cada reserva por transferencia ocupa el horario hasta 12 h sin pagar.
    await assertPublicBookingRate(tenant.id, "transfer", 3);
    const { token } = await createTransferAppointment({ slug, holdId, client });
    const instructions = await getTransferInstructions(tenant, token);
    if (!instructions) throw new Error("Tu turno quedó reservado, pero no pudimos mostrar los datos. Abrí el link de tu turno.");
    if (client.email.trim()) {
      try {
        const startsAt = new Date(instructions.startsAt);
        const policyHours = normalizeCancellationRefundHours(tenant.settings.cancellationRefundHours);
        await sendAppointmentManagementLink(client.email.trim().toLowerCase(), {
          clientName: instructions.clientName,
          businessName: tenant.name,
          serviceName: instructions.serviceName,
          date: formatInTz(startsAt, tenant.timezone, { weekday: "long", day: "numeric", month: "long" }),
          time: formatInTz(startsAt, tenant.timezone, { hour: "2-digit", minute: "2-digit" }),
          managementUrl: publicAppUrl(`/${slug}/mi-turno/${token}`).toString(),
          cancellationPolicy: `La seña es reembolsable cancelando hasta ${policyHours} horas antes del turno.`,
        });
      } catch (error) {
        console.error("[email] no se pudo enviar el enlace de gestión", error);
      }
    }
    return { ok: true, data: buildTransferPanel(tenant, slug, token, instructions) };
  } catch (error) {
    return fail(error, "No pudimos reservar el turno. Elegí el horario nuevamente.");
  }
}

export async function getPublicCheckoutQuote(tenantId: string, serviceId: string) {
  if (typeof serviceId !== "string" || !ID_PATTERN.test(serviceId)) throw new Error("No se pudo calcular la seña");
  await getTenantRecordById(tenantId);
  return publicCheckoutQuote(tenantId, serviceId);
}
