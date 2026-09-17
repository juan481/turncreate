"use server";

import { createAdminClient } from "@/server/supabase/admin";
import { isPlatformAdmin } from "@/server/platform";
import { revalidatePath } from "next/cache";

export async function toggleTenantStatusAction(tenantId: string, currentStatus: string) {
  try {
    // createAdminClient() bypassa RLS -- una Server Action es un endpoint
    // invocable directamente (no solo navegando la UI que la usa), así
    // que el chequeo de rol tiene que estar acá, no solo en el layout.
    if (!(await isPlatformAdmin())) {
      return { success: false, error: "Sin permiso" };
    }

    const supabase = createAdminClient();
    const newStatus = currentStatus === "active" ? "suspended" : "active";

    const { error } = await supabase
      .from("tenants")
      .update({ status: newStatus })
      .eq("id", tenantId);

    if (error) {
      throw error;
    }

    revalidatePath("/platform");
    return { success: true };
  } catch (error) {
    console.error("Error toggling tenant status:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
