"use server";

import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { getTenantMembershipsForUser } from "@/server/firebase/tenants";

export type ChangePasswordState = { error: string | null };

export async function changeTemporaryPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return { error: "UsÃ¡ al menos 10 caracteres, mayÃºscula, minÃºscula y nÃºmero" };
  if (password !== confirmation) return { error: "Las contraseÃ±as no coinciden" };
  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "Tu sesiÃ³n venciÃ³. VolvÃ© a ingresar." };
  const { auth, db } = firebaseAdmin();
  await Promise.all([
    auth.updateUser(user.uid, { password }),
    db.collection("users").doc(user.uid).set({ mustChangePassword: false, passwordChangedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
  ]);
  const memberships = await getTenantMembershipsForUser(user.uid);
  redirect(memberships[0] ? `/app/${memberships[0].slug}` : "/onboarding");
}
