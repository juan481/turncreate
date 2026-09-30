"use server";

import { cookies } from "next/headers";
import { createTenantForOwner } from "@/server/firebase/tenants";
import { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } from "@/server/firebase/session";

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
