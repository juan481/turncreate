"use server";

import { cookies } from "next/headers";
import { createTenantForOwner, isTenantSlugTaken } from "@/server/firebase/tenants";
import { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } from "@/server/firebase/session";

// Se consulta al pasar del paso 1: si la URL ya existe, la dueña se entera
// ahí mismo y no recién al final, después de cargar rubro y horarios.
export async function checkSlugAvailability(slug: string): Promise<{ error: string | null }> {
  const sessionCookie = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) return { error: "Tu sesión expiró. Iniciá sesión nuevamente." };
  try {
    await verifyFirebaseSession(sessionCookie);
    if (await isTenantSlugTaken(slug)) return { error: "Esa URL de turnero ya está en uso, probá con otra" };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos verificar la URL" };
  }
}

export async function createTenantAction(formData: {
  name: string;
  slug: string;
  businessTypeId: string;
  businessHours: { weekday: number; opens_at: string; closes_at: string }[];
}) {
  const sessionCookie = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!sessionCookie) throw new Error("Tu sesión expiró. Iniciá sesión nuevamente.");

  const user = await verifyFirebaseSession(sessionCookie);
  const tenant = await createTenantForOwner({
    ownerUid: user.uid,
    name: formData.name,
    slug: formData.slug,
    businessTypeId: formData.businessTypeId,
    businessHours: formData.businessHours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opens_at,
      closesAt: hour.closes_at,
    })),
  });

  return { slug: tenant.slug };
}
