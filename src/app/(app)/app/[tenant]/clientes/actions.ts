"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { createClientSchema } from "@/lib/schemas/client";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";

export type ClientActionState = { error: string | null };

export async function addClient(tenantSlug: string, _prevState: ClientActionState, formData: FormData): Promise<ClientActionState> {
  const parsed = createClientSchema.safeParse({ fullName: formData.get("fullName"), phoneE164: formData.get("phoneE164"), email: formData.get("email") || "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  try {
    const user = await getCurrentFirebaseUser();
    if (!user) return { error: "Tu sesión venció. Volvé a iniciar sesión." };
    const { tenant } = await requireTenantAccess(user.uid, tenantSlug);
    const { db } = firebaseAdmin();
    const clientRef = db.collection("tenants").doc(tenant.id).collection("clients").doc();
    const phoneRef = db.collection("tenantClientPhones").doc(`${tenant.id}_${parsed.data.phoneE164.replace(/[^0-9]/g, "")}`);
    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(phoneRef)).exists) throw new Error("Ya existe un cliente con ese teléfono");
      transaction.create(clientRef, { id: clientRef.id, tenantId: tenant.id, fullName: parsed.data.fullName, fullNameNormalized: parsed.data.fullName.toLocaleLowerCase("es-AR"), phoneE164: parsed.data.phoneE164, email: parsed.data.email || null, noShowCount: 0, appointmentsCount: 0, totalSpent: 0, lastVisitAt: null, archivedAt: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(phoneRef, { tenantId: tenant.id, clientId: clientRef.id, createdAt: FieldValue.serverTimestamp() });
    });
    revalidatePath(`/app/${tenantSlug}/clientes`);
    return { error: null };
  } catch (error) { return { error: error instanceof Error ? error.message : "No se pudo crear el cliente" }; }
}
