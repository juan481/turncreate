"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";

export type ClientNoteState = { error: string | null };

export async function addClientNote(tenantSlug: string, clientId: string, _prevState: ClientNoteState, formData: FormData): Promise<ClientNoteState> {
  const body = formData.get("body");
  if (typeof body !== "string" || !body.trim()) return { error: "La nota no puede estar vacía" };
  try {
    const user = await getCurrentFirebaseUser();
    if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." };
    const { tenant } = await requireTenantAccess(user.uid, tenantSlug);
    const clientRef = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("clients").doc(clientId);
    if (!(await clientRef.get()).exists) return { error: "El cliente no existe" };
    const note = clientRef.collection("notes").doc();
    await note.create({ id: note.id, body: body.trim(), isClinical: formData.get("isClinical") === "true", authorId: user.uid, createdAt: FieldValue.serverTimestamp() });
    revalidatePath(`/app/${tenantSlug}/clientes/${clientId}`); return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo guardar la nota" }; }
}
