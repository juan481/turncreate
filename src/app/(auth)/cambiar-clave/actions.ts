"use server";

import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { getTenantMembershipsForUser } from "@/server/firebase/tenants";
import { signInWithFirebasePassword } from "@/server/firebase/auth";
import { persistFirebaseSession } from "@/server/firebase/session";

export type ChangePasswordState = { error: string | null };

export async function changeTemporaryPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return { error: "Usá al menos 10 caracteres, mayúscula, minúscula y número" };
  if (password !== confirmation) return { error: "Las contraseñas no coinciden" };
  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "Tu sesión venció. Volvé a ingresar." };
  const { auth, db } = firebaseAdmin();
  await Promise.all([
    auth.updateUser(user.uid, { password }),
    db.collection("users").doc(user.uid).set({ mustChangePassword: false, passwordChangedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
  ]);
  // Cambiar la contraseña revoca (checkRevoked) la cookie de sesión vieja --
  // sin esto el usuario guarda la clave nueva y rebota a /login.
  if (!user.email) return { error: "Tu sesión venció. Volvé a ingresar." };
  const reauthenticated = await signInWithFirebasePassword(user.email, password);
  await persistFirebaseSession(reauthenticated.idToken);
  const memberships = await getTenantMembershipsForUser(user.uid);
  redirect(memberships[0] ? `/app/${memberships[0].slug}` : "/onboarding");
}
