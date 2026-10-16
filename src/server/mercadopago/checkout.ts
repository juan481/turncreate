import "server-only";
import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { calculateDeposit } from "@/domain/money/deposit";
import { checkoutAmounts, paymentDocument } from "@/domain/money/payment";
import { firebaseAdmin } from "@/server/firebase/admin";
import { occupancyDocId, occupancySlotInstants } from "@/server/firebase/booking";
import { getTenantBySlugFromFirebase, type TenantRecord } from "@/server/firebase/tenants";
import { isPublicHttpsUrl, mercadoPagoEnv } from "./config";
import { sellerAccessToken } from "./connections";
import { recordTrustedAnalyticsEvent } from "@/server/analytics";
import { cleanPublicClient, type PublicClientInput } from "@/server/public-booking/client";

export type BookingAttemptStatus =
  | "created"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "refund_required"
  | "refunded";

type CheckoutClient = PublicClientInput;

function depositFor(tenant: TenantRecord, total: number) {
  const settings = tenant.settings;
  return calculateDeposit(total, settings.depositType === "none"
    ? { type: "none" }
    : { type: settings.depositType, value: settings.depositValue, min: settings.depositMin });
}

function payerNames(fullName: string) {
  const [name, ...surnameParts] = fullName.trim().split(/\s+/);
  return { name, surname: surnameParts.join(" ") || undefined };
}

export async function publicCheckoutQuote(tenantId: string, serviceId: string) {
  const db = firebaseAdmin().db;
  const [tenantSnapshot, serviceSnapshot] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("tenants").doc(tenantId).collection("services").doc(serviceId).get(),
  ]);
  if (!tenantSnapshot.exists || !serviceSnapshot.exists || serviceSnapshot.data()?.active === false || serviceSnapshot.data()?.public === false || serviceSnapshot.data()?.archivedAt) throw new Error("No se pudo calcular la seña");
  const tenant = tenantSnapshot.data() as TenantRecord;
  if (tenant.status === "suspended" || tenant.settings.publicBookingEnabled === false || tenant.settings.depositType === "none") {
    throw new Error("Las reservas online no están habilitadas");
  }
  const depositAmount = depositFor(tenant, Number(serviceSnapshot.data()!.price ?? 0));
  return checkoutAmounts({
    depositAmount,
    feeMode: tenant.settings.mpFeeMode ?? "absorbed",
    feeRate: Number(tenant.settings.mpFeePercent ?? 0) / 100,
  });
}

export async function createCheckoutPreference(input: { slug: string; holdId: string; client: CheckoutClient }) {
  const client = cleanPublicClient(input.client);
  const tenant = await getTenantBySlugFromFirebase(input.slug);
  if (!tenant || tenant.status === "suspended") throw new Error("Este turnero no está disponible");
  if (tenant.settings.publicBookingEnabled === false) throw new Error("Las reservas online están pausadas");
  if (tenant.settings.payments?.mercadopagoEnabled === false) throw new Error("Este local no cobra la seña con Mercado Pago");
  const sellerOauthAccessToken = await sellerAccessToken(tenant.id);
  const db = firebaseAdmin().db;
  const tenantRef = db.collection("tenants").doc(tenant.id);
  const holdRef = tenantRef.collection("holds").doc(input.holdId);
  const holdSnapshot = await holdRef.get();
  if (!holdSnapshot.exists || holdSnapshot.data()!.expiresAt.toMillis() <= Date.now()) throw new Error("La reserva venció");
  const hold = holdSnapshot.data()!;
  const serviceSnapshot = await tenantRef.collection("services").doc(String(hold.serviceId)).get();
  if (!serviceSnapshot.exists || serviceSnapshot.data()?.active === false || serviceSnapshot.data()?.public === false || serviceSnapshot.data()?.archivedAt) throw new Error("El servicio ya no está disponible");
  const service = serviceSnapshot.data()!;
  const servicePrice = Number(service.price ?? 0);
  const depositAmount = depositFor(tenant, servicePrice);
  if (depositAmount <= 0) throw new Error("La reserva online requiere una seña configurada");
  const amounts = checkoutAmounts({
    depositAmount,
    feeMode: tenant.settings.mpFeeMode ?? "absorbed",
    feeRate: Number(tenant.settings.mpFeePercent ?? 0) / 100,
  });
  const attemptRef = db.collection("bookingAttempts").doc();
  const externalReference = `tc_${attemptRef.id}`;
  await attemptRef.create({
    id: attemptRef.id,
    externalReference,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    timezone: tenant.timezone,
    holdId: input.holdId,
    status: "created" satisfies BookingAttemptStatus,
    client,
    snapshot: {
      serviceId: hold.serviceId,
      serviceName: String(service.name ?? "Servicio"),
      servicePrice,
      staffId: hold.staffId,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
    },
    amounts,
    expiresAt: hold.expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const env = mercadoPagoEnv();
  // Seam de E2E: nunca pega contra Mercado Pago real (no hay HTTPS público ni
  // seller real en el emulador). El pago real se prueba aparte, a mano, con
  // usuarios de prueba de MP (ver docs/checklist-cuentas-externas.md).
  if (process.env.MP_E2E_STUB === "1") {
    const returnUrl = `${env.appUrl ?? "http://localhost:3000"}/${tenant.slug}/checkout?attempt=${attemptRef.id}`;
    await attemptRef.update({ preferenceId: `e2e_${attemptRef.id}`, status: "pending", updatedAt: FieldValue.serverTimestamp() });
    return {
      attemptId: attemptRef.id,
      init_point: returnUrl,
      depositAmount: amounts.appliedAmount,
      surchargeAmount: amounts.surchargeAmount,
      totalAmount: amounts.grossAmount,
    };
  }
  if (!isPublicHttpsUrl(env.appUrl)) {
    await attemptRef.delete();
    throw new Error("El checkout requiere NEXT_PUBLIC_APP_URL con HTTPS público");
  }
  const returnUrl = `${env.appUrl}/${tenant.slug}/checkout?attempt=${attemptRef.id}`;
  try {
    const payer = payerNames(client.fullName);
    const preferenceBody = {
      items: [{
        id: String(hold.serviceId),
        title: `Seña · ${String(service.name ?? "Turno")}`,
        description: `Reserva de turno en ${tenant.name}`,
        category_id: "beauty",
        quantity: 1,
        unit_price: amounts.grossAmount,
        currency_id: "ARS",
      }],
      payer: { ...payer, email: client.email || undefined },
      external_reference: externalReference,
      marketplace_fee: 0,
      metadata: { booking_attempt_id: attemptRef.id, tenant_id: tenant.id, hold_id: input.holdId },
      back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
      auto_return: "approved",
      notification_url: `${env.appUrl}/api/webhooks/mercadopago`,
      // Una seña con hold de 10 minutos no puede quedar esperando un pago
      // offline. Se permiten tarjeta y dinero en cuenta, en un solo pago.
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }],
        installments: 1,
      },
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: hold.expiresAt.toDate().toISOString(),
      binary_mode: true,
      statement_descriptor: "TURNCREATE",
    };
    const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sellerOauthAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": attemptRef.id,
      },
      body: JSON.stringify(preferenceBody),
      cache: "no-store",
    });
    if (!preferenceResponse.ok) throw new Error(`Mercado Pago rechazó el checkout (${preferenceResponse.status})`);
    const result = await preferenceResponse.json() as { id?: string; init_point?: string };
    if (!result.id || !result.init_point) throw new Error("Mercado Pago no devolvió un checkout válido");
    await attemptRef.update({ preferenceId: result.id, status: "pending", updatedAt: FieldValue.serverTimestamp() });
    return {
      attemptId: attemptRef.id,
      init_point: result.init_point,
      depositAmount: amounts.appliedAmount,
      surchargeAmount: amounts.surchargeAmount,
      totalAmount: amounts.grossAmount,
    };
  } catch (error) {
    await attemptRef.set({ status: "rejected", error: "preference_creation_failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}

function paymentFee(payment: { fee_details?: { amount?: number }[] }) {
  return (payment.fee_details ?? []).reduce((sum, detail) => sum + Number(detail.amount ?? 0), 0);
}

export async function reconcileMercadoPagoPayment(paymentId: string) {
  const db = firebaseAdmin().db;
  const eventRef = db.collection("mpWebhookEvents").doc(`payment_${paymentId}`);
  const eventSnapshot = await eventRef.get();

  // La referencia externa permite encontrar el tenant sin confiar en el body del webhook.
  // Primero se obtiene el payment con la conexión cuyo sellerId llega como query/body;
  // el webhook guarda ese sellerId antes de encolar esta reconciliación.
  const sellerId = String(eventSnapshot.data()?.sellerId ?? "");
  const seller = sellerId ? await db.collection("mpSellers").doc(sellerId).get() : null;
  if (!seller?.exists) throw new Error("No se pudo identificar la cuenta vendedora");
  const tenantId = String(seller.data()!.tenantId);
  const accessToken = await sellerAccessToken(tenantId);
  const payment = await new Payment(new MercadoPagoConfig({ accessToken })).get({ id: paymentId });
  const externalReference = String(payment.external_reference ?? "");
  if (!externalReference.startsWith("tc_")) throw new Error("Referencia externa inválida");
  const attemptId = externalReference.slice(3);
  const attemptRef = db.collection("bookingAttempts").doc(attemptId);
  const attemptSnapshot = await attemptRef.get();
  if (!attemptSnapshot.exists) throw new Error("Intento de reserva inexistente");
  const attempt = attemptSnapshot.data()!;
  if (attempt.tenantId !== tenantId || attempt.externalReference !== externalReference) throw new Error("La referencia no pertenece al vendedor");
  const expected = Number(attempt.amounts.grossAmount);
  const paid = Number(payment.transaction_amount ?? 0);
  if (Math.abs(expected - paid) > 0.01 || String(payment.currency_id) !== "ARS") throw new Error("El importe recibido no coincide");

  if (payment.status !== "approved") {
    const status: BookingAttemptStatus = payment.status === "rejected" || payment.status === "cancelled" ? "rejected" : "pending";
    await attemptRef.set({ status, paymentStatus: payment.status, externalPaymentId: String(payment.id), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await eventRef.set({
      processedAt: FieldValue.serverTimestamp(),
      processingUntil: Timestamp.fromMillis(0),
      attemptId,
      result: status,
      lastError: FieldValue.delete(),
    }, { merge: true });
    return { status };
  }

  const tenantRef = db.collection("tenants").doc(tenantId);
  const holdRef = tenantRef.collection("holds").doc(String(attempt.holdId));
  const appointmentRef = tenantRef.collection("appointments").doc();
  const appointmentToken = crypto.randomUUID().replace(/-/g, "");
  let finalStatus: BookingAttemptStatus = "approved";
  let confirmedAppointmentId: string | null = null;
  let createdNow = false;
  await db.runTransaction(async (transaction) => {
    const [freshAttempt, hold, service, staff] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(holdRef),
      transaction.get(tenantRef.collection("services").doc(String(attempt.snapshot.serviceId))),
      transaction.get(tenantRef.collection("staff").doc(String(attempt.snapshot.staffId))),
    ]);
    if (freshAttempt.data()?.appointmentId) {
      confirmedAppointmentId = String(freshAttempt.data()!.appointmentId);
      finalStatus = freshAttempt.data()?.status === "refund_required" ? "refund_required" : "approved";
      return;
    }
    const startsAt = attempt.snapshot.startsAt.toDate();
    const endsAt = attempt.snapshot.endsAt.toDate();
    const duration = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
    const occupancyRefs = occupancySlotInstants(startsAt, duration).map((instant) =>
      tenantRef.collection("occupancy").doc(occupancyDocId(String(attempt.snapshot.staffId), instant)),
    );
    const occupancy = await transaction.getAll(...occupancyRefs);
    const available = occupancy.every((slot) => !slot.exists || slot.data()?.holdId === attempt.holdId || slot.data()?.expiresAt?.toMillis?.() < Date.now());
    if (!available) {
      finalStatus = "refund_required";
      transaction.set(attemptRef, { status: finalStatus, externalPaymentId: String(payment.id), paymentStatus: payment.status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return;
    }
    const normalizedPhone = String(attempt.client.phone).replace(/\D/g, "");
    const phoneRef = db.collection("tenantClientPhones").doc(`${tenantId}_${normalizedPhone}`);
    const phone = await transaction.get(phoneRef);
    const clientId = phone.exists ? String(phone.data()!.clientId) : tenantRef.collection("clients").doc().id;
    const clientRef = tenantRef.collection("clients").doc(clientId);
    const existingClient = phone.exists ? await transaction.get(clientRef) : null;
    const appliedAmount = Number(attempt.amounts.appliedAmount);
    const feeAmount = paymentFee(payment);
    const netAmount = Number(payment.transaction_details?.net_received_amount ?? paid - feeAmount);
    if (!phone.exists) {
      transaction.create(clientRef, {
        id: clientId, tenantId, fullName: attempt.client.fullName,
        fullNameNormalized: String(attempt.client.fullName).toLocaleLowerCase("es-AR"),
        phoneE164: attempt.client.phone, email: attempt.client.email || null,
        noShowCount: 0, appointmentsCount: 1, totalSpent: appliedAmount,
        lastVisitAt: null, archivedAt: null,
        createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(phoneRef, { tenantId, clientId, createdAt: FieldValue.serverTimestamp() });
    } else {
      transaction.set(clientRef, {
        fullName: attempt.client.fullName,
        email: attempt.client.email || existingClient?.data()?.email || null,
        appointmentsCount: FieldValue.increment(1),
        totalSpent: FieldValue.increment(appliedAmount),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const servicePrice = Number(attempt.snapshot.servicePrice);
    transaction.create(appointmentRef, {
      id: appointmentRef.id, token: appointmentToken, tenantId,
      staffId: attempt.snapshot.staffId, staffName: staff.data()?.displayName ?? "", staffPhoto: staff.data()?.photoUrl ?? null,
      clientId, clientName: attempt.client.fullName, clientPhoto: existingClient?.data()?.photoUrl ?? null,
      clientPhone: attempt.client.phone, clientEmail: attempt.client.email || null,
      startsAt: attempt.snapshot.startsAt, endsAt: attempt.snapshot.endsAt,
      status: "confirmed", total: servicePrice, balance: Math.max(0, servicePrice - appliedAmount), depositPaid: appliedAmount,
      items: [{ serviceId: attempt.snapshot.serviceId, name: service.data()?.name ?? attempt.snapshot.serviceName, price: servicePrice }],
      rescheduledFromId: null, cancelReason: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    const paymentRef = appointmentRef.collection("payments").doc(String(payment.id));
    transaction.create(paymentRef, paymentDocument({
      id: paymentRef.id, kind: "deposit", method: "mercadopago", status: "approved",
      grossAmount: paid, appliedAmount, feeAmount,
      surchargeAmount: Number(attempt.amounts.surchargeAmount), netAmount,
      paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
      source: "public_checkout", externalReference, externalPaymentId: String(payment.id),
      tenantId, appointmentId: appointmentRef.id,
    }));
    occupancyRefs.forEach((ref) => transaction.set(ref, { appointmentId: appointmentRef.id, tenantId }));
    if (hold.exists) transaction.delete(holdRef);
    transaction.set(attemptRef, {
      status: "approved", appointmentId: appointmentRef.id, appointmentToken,
      externalPaymentId: String(payment.id), paymentStatus: payment.status,
      approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    confirmedAppointmentId = appointmentRef.id;
    createdNow = true;
  });
  await eventRef.set({
    processedAt: FieldValue.serverTimestamp(),
    processingUntil: Timestamp.fromMillis(0),
    attemptId,
    result: finalStatus,
    lastError: FieldValue.delete(),
  }, { merge: true });
  if (finalStatus === "approved" && createdNow) {
    await Promise.all([
      recordTrustedAnalyticsEvent({ tenantId, timezone: String(attempt.timezone ?? "America/Argentina/Buenos_Aires"), event: "paymentApproved" }),
      recordTrustedAnalyticsEvent({ tenantId, timezone: String(attempt.timezone ?? "America/Argentina/Buenos_Aires"), event: "appointmentConfirmed" }),
    ]);
  }
  return { status: finalStatus, appointmentId: finalStatus === "approved" ? confirmedAppointmentId : null };
}

export async function getBookingAttempt(attemptId: string, slug: string) {
  const snapshot = await firebaseAdmin().db.collection("bookingAttempts").doc(attemptId).get();
  if (!snapshot.exists || snapshot.data()?.tenantSlug !== slug) return null;
  const data = snapshot.data()!;
  return {
    status: data.status as BookingAttemptStatus,
    appointmentToken: data.appointmentToken ?? null,
    serviceName: data.snapshot?.serviceName ?? "Turno",
    startsAt: data.snapshot?.startsAt?.toDate?.().toISOString() ?? null,
    amounts: data.amounts,
  };
}
