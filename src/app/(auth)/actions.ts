"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { loginSchema, signUpSchema } from "@/lib/schemas/auth";
import { signInWithFirebasePassword, signUpWithFirebasePassword } from "@/server/firebase/auth";
import { firebaseAdmin } from "@/server/firebase/admin";
import { createFirebaseSession, FIREBASE_SESSION_COOKIE, firebaseSessionMaxAge } from "@/server/firebase/session";

export type AuthActionState = {
  error: string | null;
};

async function persistSession(idToken: string) {
  const session = await createFirebaseSession(idToken);
  const cookieStore = await cookies();
  cookieStore.set(FIREBASE_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: firebaseSessionMaxAge,
  });
}

async function firstTenantSlug(uid: string) {
  const { db } = firebaseAdmin();
  const memberships = await db
    .collection("users")
    .doc(uid)
    .collection("memberships")
    .where("status", "==", "active")
    .limit(1)
    .get();
  const slug = memberships.docs[0]?.data().slug;
  return typeof slug === "string" ? slug : null;
}

export async function login(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const authenticated = await signInWithFirebasePassword(parsed.data.email, parsed.data.password);
    await persistSession(authenticated.idToken);
    const tenantSlug = await firstTenantSlug(authenticated.localId);
    redirect(tenantSlug ? `/app/${tenantSlug}` : "/onboarding");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Email o contraseña incorrectos" };
  }
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    const authenticated = await signUpWithFirebasePassword(parsed.data.email, parsed.data.password);
    const { auth, db } = firebaseAdmin();
    await Promise.all([
      auth.updateUser(authenticated.localId, { displayName: parsed.data.fullName }),
      db.collection("users").doc(authenticated.localId).set({
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }),
    ]);
    await persistSession(authenticated.idToken);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la cuenta" };
  }

  redirect("/onboarding");
}
