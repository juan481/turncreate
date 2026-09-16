"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";

export async function cancelAppointmentAction(token: string, slug: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("cancel_appointment_by_token", {
    p_token: token,
  });

  if (error) {
    console.error("Error cancelling appointment:", error.message);
  }

  revalidatePath(`/${slug}/mi-turno/${token}`);
}
