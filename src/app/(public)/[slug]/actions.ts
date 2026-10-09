"use server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import type { TenantRecord } from "@/server/firebase/tenants";
import { getServiceRecord, listAvailableStarts, occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import type { ClientFormData, PublicAppointment, PublicCategory, PublicHold, PublicStaffMember, PublicTenant } from "./types";

const token = () => crypto.randomUUID().replace(/-/g, "");

async function getTenantRecordById(tenantId: string): Promise<TenantRecord> {
  const doc = await firebaseAdmin().db.collection("tenants").doc(tenantId).get();
  return doc.data() as TenantRecord;
}

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const tenant = await getTenantBySlugFromFirebase(slug);
  return tenant
    ? { id: tenant.id, slug: tenant.slug, name: tenant.name, logo_url: (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null, timezone: tenant.timezone }
    : null;
}

export async function getPublicCatalog(tenantId: string): Promise<PublicCategory[]> {
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("services").where("active", "==", true).get();
  return [
    {
      id: "services",
      name: "Servicios",
      services: docs.docs
        .filter((doc) => !doc.data().archivedAt)
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: null,
            price: Number(data.price),
            duration: (data.phases ?? []).reduce((sum: number, phase: { minutes?: number }) => sum + Number(phase.minutes ?? 0), Number(data.bufferAfterMin ?? 0)),
          };
        }),
    },
  ];
}

export async function getPublicStaff(tenantId: string): Promise<PublicStaffMember[]> {
  const docs = await firebaseAdmin().db.collection("tenants").doc(tenantId).collection("staff").where("active", "==", true).get();
  return docs.docs.map((doc) => ({ id: doc.id, name: String(doc.data().displayName), photo_url: (doc.data().photoUrl as string | null) ?? null }));
}

export async function getPublicStaffForService(tenantId: string, serviceId: string): Promise<PublicStaffMember[]> {
  const staff = await getPublicStaff(tenantId);
  const db = firebaseAdmin().db;
  const matches = await Promise.all(staff.map(async (person) => ({ person, doc: await db.collection("tenants").doc(tenantId).collection("staff").doc(person.id).get() })));
  return matches.filter(({ doc }) => (doc.data()?.serviceIds ?? []).includes(serviceId)).map(({ person }) => person);
}

export async function getAvailableSlots(tenantId: string, serviceId: string, staffId: string | "any", dateISO: string, timezone: string, allStaffIds: string[]): Promise<string[]> {
  const tenant = await getTenantRecordById(tenantId);
  const staffIdForLookup = staffId === "any" && allStaffIds.length === 0 ? "any" : staffId;
  const starts = await listAvailableStarts({ tenantId, tenant, serviceId, staffId: staffIdForLookup, dateISO, timezone });
  return starts.map((d) => d.toISOString());
}

export async function createHold(tenantId: string, serviceId: string, staffId: string | "any", allStaffIds: string[], startsAtISO: string, _dateISO: string, _timezone: string): Promise<PublicHold> {
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
      const existing = await Promise.all(slots.map((slot) => transaction.get(slot)));
      if (existing.some((doc) => doc.exists && (!doc.data()?.expiresAt || doc.data()?.expiresAt.toDate() > new Date()))) continue;

      selected = candidate;
      const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60_000));
      slots.forEach((slot) => transaction.set(slot, { holdId: holdRef.id, expiresAt }));
      transaction.set(holdRef, { id: holdRef.id, tenantId, staffId: selected, serviceId, startsAt: Timestamp.fromDate(start), endsAt: Timestamp.fromDate(end), expiresAt, createdAt: FieldValue.serverTimestamp() });
      break;
    }
    if (!selected) throw new Error("Ese horario ya no está disponible");
  });

  const hold = (await holdRef.get()).data()!;
  return { id: holdRef.id, tenant_id: tenantId, staff_id: selected, starts_at: hold.startsAt.toDate().toISOString(), ends_at: hold.endsAt.toDate().toISOString(), expires_at: hold.expiresAt.toDate().toISOString() };
}

export async function confirmHold(holdId: string, client: ClientFormData): Promise<PublicAppointment> {
  const db = firebaseAdmin().db;
  const holds = await db.collectionGroup("holds").where("id", "==", holdId).limit(1).get();
  if (holds.empty) throw new Error("La reserva venció");
  const holdRef = holds.docs[0].ref;
  const hold = holds.docs[0].data();
  if (hold.expiresAt.toDate() < new Date()) throw new Error("La reserva venció");

  const tenantRef = holdRef.parent.parent!;
  const appointmentRef = tenantRef.collection("appointments").doc();
  const appointmentToken = token();
  // Mismo patrón que addClient/createClientQuick: un cliente por teléfono
  // normalizado (tenantClientPhones), para que reservar dos veces con el
  // mismo teléfono desde el turnero público reuse el cliente existente en
  // vez de crear uno nuevo cada vez. Antes esta función no guardaba
  // clientId NI items con serviceId -- el turno público quedaba con un
  // shape distinto al turno interno, y eso rompía dos cosas río abajo: el
  // link "ver cliente" desde la ficha del turno (iba a /clientes/undefined)
  // y mover ese turno por drag&drop ("No se pudo determinar el servicio
  // del turno", porque move-appointment-action.ts busca items[0].serviceId).
  const normalizedPhone = client.phone_e164.replace(/[^0-9]/g, "");
  const phoneRef = db.collection("tenantClientPhones").doc(`${hold.tenantId}_${normalizedPhone}`);

  await db.runTransaction(async (transaction) => {
    const latest = await transaction.get(holdRef);
    if (!latest.exists || latest.data()!.expiresAt.toDate() < new Date()) throw new Error("La reserva venció");
    const service = await transaction.get(tenantRef.collection("services").doc(hold.serviceId));
    // El home del panel y Caja leen staffName/staffPhoto del propio turno
    // (no hacen join en vivo con staff), hay que denormalizarlos acá.
    const staffDoc = await transaction.get(tenantRef.collection("staff").doc(hold.staffId));

    const phoneSnap = await transaction.get(phoneRef);
    let clientId: string;
    let clientPhoto: string | null = null;
    if (phoneSnap.exists) {
      clientId = String(phoneSnap.data()!.clientId);
      const existingClient = await transaction.get(tenantRef.collection("clients").doc(clientId));
      clientPhoto = (existingClient.data()?.photoUrl as string | null | undefined) ?? null;
    } else {
      const clientRef = tenantRef.collection("clients").doc();
      clientId = clientRef.id;
      transaction.create(clientRef, {
        id: clientRef.id,
        tenantId: hold.tenantId,
        fullName: client.full_name,
        fullNameNormalized: client.full_name.toLocaleLowerCase("es-AR"),
        phoneE164: client.phone_e164,
        email: client.email || null,
        noShowCount: 0,
        appointmentsCount: 0,
        totalSpent: 0,
        lastVisitAt: null,
        archivedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(phoneRef, { tenantId: hold.tenantId, clientId, createdAt: FieldValue.serverTimestamp() });
    }

    const servicePrice = Number(service.data()?.price ?? 0);
    transaction.create(appointmentRef, {
      id: appointmentRef.id,
      token: appointmentToken,
      tenantId: hold.tenantId,
      staffId: hold.staffId,
      staffName: staffDoc.data()?.displayName ?? "",
      staffPhoto: staffDoc.data()?.photoUrl ?? null,
      clientId,
      clientName: client.full_name,
      clientPhoto,
      clientPhone: client.phone_e164,
      clientEmail: client.email || null,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      status: "confirmed",
      total: servicePrice,
      balance: servicePrice,
      depositPaid: 0,
      items: [{ serviceId: hold.serviceId, name: service.data()?.name ?? "Servicio", price: servicePrice }],
      rescheduledFromId: null,
      cancelReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Convierte el hold (temporal, con expiresAt) en ocupación permanente
    // del turno confirmado -- si no, el slot queda libre para otro cliente
    // en cuanto se borra el hold (doble reserva).
    const durationMin = Math.round((hold.endsAt.toDate().getTime() - hold.startsAt.toDate().getTime()) / 60_000);
    for (const instant of occupancySlotInstants(hold.startsAt.toDate(), durationMin)) {
      transaction.set(tenantRef.collection("occupancy").doc(occupancyDocId(hold.staffId, instant)), {
        appointmentId: appointmentRef.id,
        tenantId: hold.tenantId,
      });
    }

    transaction.delete(holdRef);
  });

  const servicePrice = Number((await tenantRef.collection("services").doc(hold.serviceId).get()).data()?.price ?? 0);
  return { id: appointmentRef.id, token: appointmentToken, status: "confirmed", starts_at: hold.startsAt.toDate().toISOString(), ends_at: hold.endsAt.toDate().toISOString(), total: servicePrice, balance: servicePrice };
}
