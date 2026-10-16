"use server";

import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { createInternalAppointment } from "@/server/firebase/booking";
import { sendAppointmentConfirmation } from "@/server/email";
import { birthYearFromAge, createClientSchema } from "@/lib/schemas/client";
import { formatTimeInTz, longDayLabel, todayISO } from "@/lib/dates";

export type ConfirmAppointmentState = { error: string | null };

// Cliente nuevo cargado en el momento de agendar (sección 3.5: un turno
// manual no debería requerir salir del flujo a /clientes primero).
export async function createClientQuick(
  tenantSlug: string,
  data: { fullName: string; phoneE164: string; email: string; age?: string },
): Promise<{ id: string } | { error: string }> {
  const parsed = createClientSchema.safeParse({
    fullName: data.fullName,
    phone: data.phoneE164,
    email: data.email || "",
    age: data.age ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const user = await getCurrentFirebaseUser();
    if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." };
    const { tenant } = await requireTenantAccess(user.uid, tenantSlug);
    const { db } = firebaseAdmin();
    const clientRef = db.collection("tenants").doc(tenant.id).collection("clients").doc();
    const phoneRef = db.collection("tenantClientPhones").doc(`${tenant.id}_${parsed.data.phone.replace(/[^0-9]/g, "")}`);
    // Solo se guarda el año (aproximado), igual que en clientes/actions.ts.
    const currentYear = Number(todayISO(tenant.timezone).slice(0, 4));
    const birthYear = parsed.data.age ? birthYearFromAge(parsed.data.age, currentYear) : null;

    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(phoneRef)).exists) throw new Error("Ya existe un cliente con ese teléfono");
      transaction.create(clientRef, {
        id: clientRef.id,
        tenantId: tenant.id,
        fullName: parsed.data.fullName,
        fullNameNormalized: parsed.data.fullName.toLocaleLowerCase("es-AR"),
        phoneE164: parsed.data.phone,
        email: parsed.data.email || null,
        birthYear,
        noShowCount: 0,
        appointmentsCount: 0,
        totalSpent: 0,
        lastVisitAt: null,
        archivedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(phoneRef, { tenantId: tenant.id, clientId: clientRef.id, createdAt: FieldValue.serverTimestamp() });
    });

    return { id: clientRef.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el cliente" };
  }
}

export async function confirmAppointment(
  tenantSlug: string,
  _prevState: ConfirmAppointmentState,
  formData: FormData,
): Promise<ConfirmAppointmentState> {
  const staffId = formData.get("staffId");
  const clientId = formData.get("clientId");
  const serviceId = formData.get("serviceId");
  const dateISO = formData.get("date");
  const startsAtISO = formData.get("startsAt");
  const rescheduleFrom = formData.get("rescheduleFrom");
  const keepDeposit = formData.get("keepDeposit") !== "false";
  const depositAmountRaw = formData.get("depositAmount");
  const depositMethodRaw = formData.get("depositMethod");
  const appointmentNote = String(formData.get("appointmentNote") ?? "").slice(0, 1000);
  const depositAmount =
    typeof depositAmountRaw === "string" && depositAmountRaw ? Number(depositAmountRaw) : 0;
  const depositMethod = depositMethodRaw === "cash" || depositMethodRaw === "mercadopago" || depositMethodRaw === "transfer" || depositMethodRaw === "card_posnet" ? depositMethodRaw : undefined;

  if (
    typeof staffId !== "string" ||
    typeof clientId !== "string" ||
    typeof serviceId !== "string" ||
    typeof dateISO !== "string" ||
    typeof startsAtISO !== "string"
  ) {
    return { error: "Faltan datos para confirmar el turno" };
  }

  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." };

  let tenant;
  try {
    ({ tenant } = await requireTenantAccess(user.uid, tenantSlug));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No tenés acceso a este local" };
  }

  const { db } = firebaseAdmin();
  const clientDoc = await db.collection("tenants").doc(tenant.id).collection("clients").doc(clientId).get();
  if (!clientDoc.exists) return { error: "El cliente no existe" };
  const client = clientDoc.data()!;

  const rescheduledFromId = typeof rescheduleFrom === "string" && rescheduleFrom ? rescheduleFrom : undefined;
  let keptDeposit = 0;
  if (rescheduledFromId && keepDeposit) {
    const oldDoc = await db.collection("tenants").doc(tenant.id).collection("appointments").doc(rescheduledFromId).get();
    keptDeposit = Number(oldDoc.data()?.depositPaid ?? 0);
  }

  try {
    await createInternalAppointment({
      tenantId: tenant.id,
      tenant,
      serviceId,
      staffId,
      startsAtISO,
      clientId,
      clientName: String(client.fullName),
      clientPhone: String(client.phoneE164),
      clientEmail: client.email ?? null,
      depositAmount: depositAmount > 0 ? depositAmount : keptDeposit,
      depositMethod: depositAmount > 0 ? depositMethod : undefined,
      rescheduledFromId,
      changedBy: user.uid,
      appointmentNote,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo confirmar el turno" };
  }

  // Envío de confirmación por mail (fire and forget -- nunca bloquea el redirect).
  void (async () => {
    try {
      if (!client.email) return;
      const startsAtDate = new Date(startsAtISO);
      const date = startsAtDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tenant.timezone });
      const time = startsAtDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tenant.timezone });
      const serviceDoc = await db.collection("tenants").doc(tenant.id).collection("services").doc(serviceId).get();
      await sendAppointmentConfirmation(client.email, {
        clientName: String(client.fullName),
        businessName: tenant.name,
        serviceName: String(serviceDoc.data()?.name ?? "Turno"),
        date,
        time,
        address: (tenant as typeof tenant & { address?: string | null }).address ?? undefined,
        whatsapp: (tenant as typeof tenant & { whatsappNumber?: string | null }).whatsappNumber ?? undefined,
      });
    } catch (e) {
      console.error("[email] confirmation failed:", e);
    }
  })();

  // `creado=1` + `mensaje=` quedan en la URL del redirect para que
  // agenda/page.tsx (fuera de este alcance -- la están rediseñando en
  // paralelo) pueda mostrar un toast de éxito con useToast() ahí (un
  // server action no puede llamar hooks de cliente). El mensaje ya viene
  // armado del lado del servidor para que esa pantalla solo tenga que
  // decodificarlo y mostrarlo, sin tener que reconstruir fecha/hora.
  const successMessage = `Turno agendado para ${longDayLabel(dateISO)} a las ${formatTimeInTz(startsAtISO, tenant.timezone)}`;
  redirect(`/app/${tenantSlug}/agenda?date=${dateISO}&creado=1&mensaje=${encodeURIComponent(successMessage)}`);
}
