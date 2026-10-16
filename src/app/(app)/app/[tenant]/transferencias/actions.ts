"use server";

import { revalidatePath } from "next/cache";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { cancelPendingTransfer, confirmTransferDeposit } from "@/server/public-booking/transfer";

export type TransferDecisionResult = { ok: true; message: string } | { ok: false; error: string };

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** Auth + local: el turno siempre se busca adentro de tenants/{tenant.id}, nunca por un id suelto. */
async function authorize(slug: string, appointmentId: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("No autorizado");
  if (typeof slug !== "string" || typeof appointmentId !== "string" || !ID_PATTERN.test(appointmentId)) throw new Error("El turno no existe");
  const { tenant } = await requireTenantAccess(user.uid, slug);
  return { user, tenant };
}

function refresh(slug: string, appointmentId: string) {
  revalidatePath(`/app/${slug}/transferencias`);
  revalidatePath(`/app/${slug}/agenda/${appointmentId}`);
  revalidatePath(`/app/${slug}/agenda`);
  revalidatePath(`/app/${slug}/caja`);
  revalidatePath(`/app/${slug}/reportes`);
  revalidatePath(`/app/${slug}`);
}

/** Llegó el comprobante: registra la seña por transferencia y confirma el turno. */
export async function confirmTransferAction(slug: string, appointmentId: string): Promise<TransferDecisionResult> {
  try {
    const { user, tenant } = await authorize(slug, appointmentId);
    const result = await confirmTransferDeposit({ tenantId: tenant.id, timezone: tenant.timezone, appointmentId, changedBy: user.uid });
    refresh(slug, appointmentId);
    return { ok: true, message: result === "already_confirmed" ? "Esa seña ya estaba confirmada" : "Seña confirmada: el turno quedó confirmado" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo confirmar la seña" };
  }
}

/** No llegó (o no coincide): cancela el turno y libera el horario. */
export async function rejectTransferAction(slug: string, appointmentId: string): Promise<TransferDecisionResult> {
  try {
    const { user, tenant } = await authorize(slug, appointmentId);
    await cancelPendingTransfer({ tenantId: tenant.id, appointmentId, reason: "La transferencia de la seña no llegó", changedBy: user.uid });
    refresh(slug, appointmentId);
    return { ok: true, message: "Transferencia rechazada: el horario quedó libre" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo rechazar la transferencia" };
  }
}
