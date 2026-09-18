"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { sendAppointmentCancellation } from "@/server/email";

export type ChangeStatusState = { error: string | null };

export async function changeStatus(
  tenantSlug: string,
  appointmentId: string,
  dateISO: string,
  _prevState: ChangeStatusState,
  formData: FormData,
): Promise<ChangeStatusState> {
  const toStatus = formData.get("toStatus");
  const reason = formData.get("reason");

  if (typeof toStatus !== "string") {
    return { error: "Falta el estado destino" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_appointment", {
    p_appointment_id: appointmentId,
    p_to_status: toStatus,
    p_reason: typeof reason === "string" && reason.length > 0 ? reason : undefined,
  });

  if (error) {
    return { error: error.message };
  }

  // Cancellation email (fire and forget)
  if (toStatus === "cancelled") {
    void (async () => {
      try {
        const { data: appt } = await supabase
          .from("appointments")
          .select("starts_at, cancel_reason, clients(full_name, email), appointment_items(name), tenants(name, address, whatsapp_number, timezone)")
          .eq("id", appointmentId)
          .maybeSingle();
        const clientRow = appt?.clients as { full_name: string; email?: string | null } | null;
        const clientEmail = clientRow?.email;
        if (appt && clientEmail) {
          const tenantData = appt.tenants as { name: string; address?: string | null; whatsapp_number?: string | null; timezone: string } | null;
          const tz = tenantData?.timezone ?? "America/Argentina/Buenos_Aires";
          const startsAtDate = new Date(appt.starts_at);
          await sendAppointmentCancellation(clientEmail, {
            clientName: clientRow.full_name,
            businessName: tenantData?.name ?? "",
            serviceName: (appt.appointment_items as { name: string }[])[0]?.name ?? "Turno",
            date: startsAtDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
            time: startsAtDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
            reason: appt.cancel_reason ?? (typeof reason === "string" ? reason : undefined),
            whatsapp: tenantData?.whatsapp_number ?? undefined,
          });
        }
      } catch (e) {
        console.error("[email] cancellation failed:", e);
      }
    })();
  }

  revalidatePath(`/app/${tenantSlug}/agenda`);
  redirect(`/app/${tenantSlug}/agenda?date=${dateISO}`);
}
