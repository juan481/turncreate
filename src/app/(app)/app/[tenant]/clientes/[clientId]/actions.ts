"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";

export type ClientNoteState = { error: string | null };

export async function addClientNote(
  tenantSlug: string,
  clientId: string,
  _prevState: ClientNoteState,
  formData: FormData,
): Promise<ClientNoteState> {
  const body = formData.get("body");
  const isClinical = formData.get("isClinical") === "true";

  if (typeof body !== "string" || !body.trim()) {
    return { error: "La nota no puede estar vacía" };
  }

  const supabase = await createClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();

  if (authError || !userData.user) {
    return { error: "No autorizado" };
  }

  const { error } = await supabase.from("client_notes").insert({
    client_id: clientId,
    body: body.trim(),
    is_clinical: isClinical,
    author_id: userData.user.id
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/clientes/${clientId}`);
  return { error: null };
}
