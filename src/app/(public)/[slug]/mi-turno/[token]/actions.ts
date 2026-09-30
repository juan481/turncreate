"use server";
import { revalidatePath } from "next/cache";
import { firebaseAdmin } from "@/server/firebase/admin";
import { releaseAppointmentOccupancy } from "@/server/firebase/booking";
export async function cancelAppointmentAction(token: string, slug: string) {
  const result = await firebaseAdmin().db.collectionGroup("appointments").where("token", "==", token).limit(1).get();
  if (!result.empty) {
    const doc = result.docs[0];
    const tenantId = String(doc.data().tenantId);
    await doc.ref.update({ status: "cancelled", cancelledAt: new Date() });
    await releaseAppointmentOccupancy(tenantId, doc.id);
  }
  revalidatePath(`/${slug}/mi-turno/${token}`);
}
