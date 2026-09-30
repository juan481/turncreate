"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE } from "@/server/firebase/session";

export async function signOut() {
  (await cookies()).delete(FIREBASE_SESSION_COOKIE);
  redirect("/login");
}
