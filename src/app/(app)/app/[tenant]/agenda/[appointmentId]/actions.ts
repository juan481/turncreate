"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
export type ChangeStatusState = { error: string | null };
// cancelled/no_show liberan el horario (sección 5.3: el turno ya no ocupa
// lugar); completed lo mantiene ocupado como historial.
const RELEASES_OCCUPANCY = new Set(["cancelled", "no_show"]);
export async function changeStatus(slug: string, appointmentId: string, dateISO: string, _prev: ChangeStatusState, formData: FormData): Promise<ChangeStatusState> { const status = formData.get("toStatus"); if (typeof status !== "string") return { error: "Falta el estado destino" }; const user = await getCurrentFirebaseUser(); if (!user) return { error: "No autorizado" }; const { tenant } = await requireTenantAccess(user.uid, slug); await firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("appointments").doc(appointmentId).update({ status, cancelReason: String(formData.get("reason") || "") || null, updatedAt: new Date() }); if (RELEASES_OCCUPANCY.has(status)) await releaseAppointmentOccupancy(tenant.id, appointmentId); revalidatePath(`/app/${slug}/agenda`); redirect(`/app/${slug}/agenda?date=${dateISO}`); }
