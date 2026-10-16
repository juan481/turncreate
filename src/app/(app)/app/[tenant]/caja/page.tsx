import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getPaymentBreakdown, getPayments, getRefundDueAppointmentIds } from "@/server/firebase/stats";
import type { DocumentData } from "firebase-admin/firestore";
import { awaitsDeposit, porCobrarOf, summarizeAppointments } from "@/server/firebase/stats-model";
import { dayRange, todayISO } from "@/lib/dates";
import { planFeatures } from "@/lib/plans";
import { CajaClient, type AppointmentDue, type RefundDueItem } from "./caja-client";
import { CajaTabs } from "./caja-tabs";

const APPOINTMENT_FIELDS = ["startsAt", "status", "total", "balance", "clientName", "staffName", "items", "serviceName", "awaitingTransfer", "depositDue"] as const;

function toDue(id: string, item: DocumentData): AppointmentDue {
  return {
    id,
    startsAt: item.startsAt?.toDate?.().toISOString?.() ?? "",
    total: Number(item.total ?? 0),
    balance: Number(item.balance ?? 0),
    depositDue: Number(item.depositDue ?? 0),
    clientName: String(item.clientName ?? ""),
    staffName: String(item.staffName ?? ""),
    serviceNames: Array.isArray(item.items)
      ? item.items.map((service: { name?: string }) => service.name ?? "").join(", ")
      : String(item.serviceName ?? ""),
  };
}

export default async function CajaPage({ params }: PageProps<"/app/[tenant]/caja">) {
  const { tenant: tenantSlug } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);

  const { db } = firebaseAdmin();
  const ref = db.collection("tenants").doc(tenant.id);
  const sessions = ref.collection("cashSessions");
  const range = dayRange(todayISO(tenant.timezone), tenant.timezone);
  const features = planFeatures(tenant);

  // Antes: TODAS las cashSessions del local (crece un doc por día, para
  // siempre). Ahora: la abierta (closedAt == null, explícito al abrir) y la
  // última cerrada. En orden desc los `null` van al final, así que el
  // primer resultado es una cerrada si existe alguna. Ambas son queries de
  // un solo campo (índice automático).
  const [openSnapshot, lastClosedSnapshot, appointments, products, paymentBreakdown] = await Promise.all([
    features.cashSessions ? sessions.where("closedAt", "==", null).limit(1).get() : null,
    features.cashSessions
      ? sessions.orderBy("closedAt", "desc").limit(1).select("closedAt", "expectedAmount", "countedAmount", "difference").get()
      : null,
    ref.collection("appointments")
      .where("startsAt", ">=", range.start)
      .where("startsAt", "<", range.end)
      .orderBy("startsAt")
      .select(...APPOINTMENT_FIELDS)
      .get(),
    ref.collection("products").where("active", "==", true).select("name", "price").get(),
    getPaymentBreakdown(tenant.id, range),
  ]);

  const open = openSnapshot?.docs[0] ?? null;
  // Una sola sesión abierta → una sola query de movimientos (no N+1).
  const movements = open ? await open.ref.collection("movements").orderBy("createdAt", "desc").get() : null;
  const lastClosedDoc = lastClosedSnapshot?.docs[0];
  const lastClosed = lastClosedDoc?.data().closedAt ? lastClosedDoc.data() : null;

  // "Por cobrar" con la definición única (stats-model.ts): confirmados y
  // completados con saldo. Los pending_payment se listan aparte: todavía
  // esperan la seña, pero si pagan acá se confirman. Los que esperan una
  // transferencia NO se cobran acá (no es el saldo lo que falta, es
  // confirmar la seña): van en su propia lista con "Confirmar transferencia".
  const due: AppointmentDue[] = [];
  const awaitingDeposit: AppointmentDue[] = [];
  const awaitingTransfer: AppointmentDue[] = [];
  for (const doc of appointments.docs) {
    const data = doc.data();
    const item = toDue(doc.id, data);
    if (!item.startsAt) continue;
    if (porCobrarOf(data) > 0) due.push(item);
    else if (awaitsDeposit(data) && data.awaitingTransfer === true) awaitingTransfer.push(item);
    else if (awaitsDeposit(data) && item.balance > 0) awaitingDeposit.push(item);
  }

  // Turnos detrás del "A devolver" de hoy, para poder abrir cada uno y
  // marcar la seña devuelta. Pagos y turnos a devolver ya están en caché
  // del request (los leyó getPaymentBreakdown): solo se leen los nombres.
  const refundDue: RefundDueItem[] = [];
  if (paymentBreakdown.refundDue.count > 0) {
    const [todayPayments, refundIds] = await Promise.all([getPayments(tenant.id, range), getRefundDueAppointmentIds(tenant.id)]);
    const ids = [...new Set(todayPayments.map((payment) => payment.appointmentId).filter((id): id is string => id !== null && refundIds.has(id)))];
    if (ids.length > 0) {
      const docs = await db.getAll(...ids.map((id) => ref.collection("appointments").doc(id)), { fieldMask: ["clientName"] });
      for (const doc of docs) {
        refundDue.push({ id: doc.id, clientName: String(doc.data()?.clientName ?? ""), href: `/app/${tenantSlug}/agenda/${doc.id}` });
      }
    }
  }

  const paymentsByMethod = Object.fromEntries(
    Object.entries(paymentBreakdown.byMethod).map(([method, totals]) => [method, totals.gross]),
  );

  return (
    <div className="space-y-lg">
      <CajaTabs tenantSlug={tenantSlug} active="hoy" />
      <CajaClient
        cashSessionsEnabled={features.cashSessions}
        tenantSlug={tenantSlug}
        timezone={tenant.timezone}
        session={open ? {
          id: open.id,
          opened_at: open.data().openedAt?.toDate?.().toISOString?.() ?? new Date().toISOString(),
          opening_amount: Number(open.data().openingAmount ?? 0),
        } : null}
        appointments={due}
        awaitingDeposit={awaitingDeposit}
        awaitingTransfer={awaitingTransfer}
        totals={{
          cobrado: paymentBreakdown.gross,
          porCobrar: summarizeAppointments(appointments.docs.map((doc) => doc.data())).porCobrar,
          aDevolver: paymentBreakdown.refundDue.gross,
          aDevolverCount: paymentBreakdown.refundDue.count,
          refundDue,
        }}
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
    </div>
  );
}
