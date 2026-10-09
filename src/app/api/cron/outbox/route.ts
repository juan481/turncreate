import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { sendAppointmentReminder } from "@/server/email";
import { formatInTz } from "@/lib/dates";

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = firebaseAdmin().db;
  const events = await db.collectionGroup("outbox").where("status", "==", "pending").limit(50).get();
  let processed = 0;
  let failed = 0;
  for (const event of events.docs) {
    try {
      const data = event.data();
      if (data.type === "appointment_reminder") {
        const appointment = await event.ref.parent.parent!.collection("appointments").doc(data.appointmentId).get();
        const item = appointment.data();
        const tenant = await event.ref.parent.parent!.get();
        const tenantData = tenant.data();
        // No mandar el recordatorio si el turno ya no está activo (se
        // canceló o venció después de encolar el evento).
        const isActive = item?.status === "confirmed" || item?.status === "pending_payment";
        if (item?.clientEmail && isActive && item.startsAt?.toDate) {
          const timezone = String(tenantData?.timezone ?? "America/Argentina/Buenos_Aires");
          const instant = item.startsAt.toDate();
          await sendAppointmentReminder(item.clientEmail, {
            clientName: item.clientName ?? "Cliente",
            businessName: tenantData?.name ?? "",
            serviceName: item.items?.[0]?.name ?? "Turno",
            date: formatInTz(instant, timezone, { dateStyle: "long" }),
            time: formatInTz(instant, timezone, { hour: "2-digit", minute: "2-digit" }),
          });
        }
      }
      await event.ref.update({ status: "processed", processedAt: new Date() });
      processed++;
    } catch {
      await event.ref.update({ status: "failed", failedAt: new Date() });
      failed++;
    }
  }
  return NextResponse.json({ processed, failed });
}
