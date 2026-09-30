"use server";
import { revalidatePath } from "next/cache";
import { firebaseAdmin } from "@/server/firebase/admin";
export async function cancelAppointmentAction(token: string, slug: string) { const result = await firebaseAdmin().db.collectionGroup("appointments").where("token", "==", token).limit(1).get(); if (!result.empty) await result.docs[0].ref.update({ status: "cancelled", cancelledAt: new Date() }); revalidatePath(`/${slug}/mi-turno/${token}`); }
