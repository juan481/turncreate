"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";

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

  revalidatePath(`/app/${tenantSlug}/agenda`);
  redirect(`/app/${tenantSlug}/agenda?date=${dateISO}`);
}
