"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { computeSegmentInstants, getServiceCombo, instantToMinutes } from "@/server/availability";
import { computeTotalDuration } from "@/domain/availability";

export type ConfirmAppointmentState = { error: string | null };

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

  if (
    typeof staffId !== "string" ||
    typeof clientId !== "string" ||
    typeof serviceId !== "string" ||
    typeof dateISO !== "string" ||
    typeof startsAtISO !== "string"
  ) {
    return { error: "Faltan datos para confirmar el turno" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);
  const combo = await getServiceCombo(supabase, [serviceId]);

  const startMinute = instantToMinutes(startsAtISO, tenant.timezone);
  const segments = computeSegmentInstants({ dateISO, startMinute, combo, timezone: tenant.timezone });

  const startsAt = new Date(startsAtISO);
  const totalDuration = computeTotalDuration(combo.phases, combo.bufferAfterMin);
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

  const { error } = await supabase.rpc("create_staff_appointment", {
    p_tenant_id: tenant.id,
    p_staff_id: staffId,
    p_client_id: clientId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_items: [
      {
        service_id: serviceId,
        name: combo.items[0].name,
        price: combo.items[0].price,
        phases: combo.items[0].phases,
        buffer_min: combo.items[0].bufferAfterMin,
      },
    ],
    p_segments: segments.map((s) => ({
      starts_at: s.startsAt.toISOString(),
      ends_at: s.endsAt.toISOString(),
    })),
    p_rescheduled_from_id:
      typeof rescheduleFrom === "string" && rescheduleFrom ? rescheduleFrom : undefined,
  });

  if (error) {
    return { error: error.message };
  }

  redirect(`/app/${tenantSlug}/agenda?date=${dateISO}`);
}
