import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAppointmentReminder } from "@/server/email";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(req: Request) {
  // Protect with a simple bearer token in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { data: events, error: fetchError } = await supabase
    .from("outbox_events")
    .select("*")
    .eq("status", "pending")
    .lte("next_retry_at", new Date().toISOString())
    .limit(50);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ message: "No pending events", processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      if (event.type === "appointment_reminder") {
        const appointmentId = event.payload?.appointment_id as string;
        if (appointmentId) {
          const { data: appt } = await supabase
            .from("appointments")
            .select("starts_at, clients(full_name, email), appointment_items(name), tenants(name, address, whatsapp_number, timezone)")
            .eq("id", appointmentId)
            .maybeSingle();

          const clientEmail = (appt?.clients as { email?: string | null } | null)?.email;
          if (appt && clientEmail) {
            const tenantData = appt.tenants as unknown as { name: string; address?: string | null; whatsapp_number?: string | null; timezone: string } | null;
            const tz = tenantData?.timezone ?? "America/Argentina/Buenos_Aires";
            const startsAtDate = new Date(appt.starts_at);
            await sendAppointmentReminder(clientEmail, {
              clientName: (appt.clients as unknown as { full_name: string }).full_name,
              businessName: tenantData?.name ?? "",
              serviceName: (appt.appointment_items as { name: string }[])[0]?.name ?? "Turno",
              date: startsAtDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
              time: startsAtDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
              address: tenantData?.address ?? undefined,
              whatsapp: tenantData?.whatsapp_number ?? undefined,
            });

            await supabase.from("message_logs").insert({
              tenant_id: event.tenant_id,
              outbox_event_id: event.id,
              recipient: clientEmail,
              message_type: "email_reminder",
              content: `Reminder sent for appointment ${appointmentId}`,
              status: "sent",
            });
          }
        }
      } else {
        // Other event types: log as simulated until channels are configured
        console.log(`[OUTBOX] Unhandled event type: ${event.type}`, event.payload);
        await supabase.from("message_logs").insert({
          tenant_id: event.tenant_id,
          outbox_event_id: event.id,
          recipient: "n/a",
          message_type: event.type,
          content: `Simulated: ${JSON.stringify(event.payload)}`,
          status: "sent",
        });
      }

      await supabase
        .from("outbox_events")
        .update({ status: "processed", updated_at: new Date().toISOString() })
        .eq("id", event.id);

      processed++;
    } catch (err) {
      console.error(`[OUTBOX] Failed event ${event.id}:`, err);
      const newRetries = (event.retries ?? 0) + 1;
      const status = newRetries >= 3 ? "failed" : "pending";
      await supabase
        .from("outbox_events")
        .update({
          status,
          retries: newRetries,
          next_retry_at: new Date(Date.now() + 5 * 60_000 * newRetries).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", event.id);
      failed++;
    }
  }

  return NextResponse.json({ message: "Outbox processed", processed, failed });
}
