import "server-only";
import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } from "./session";

export async function getCurrentFirebaseUser() {
  const session = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    return await verifyFirebaseSession(session);
  } catch {
    return null;
  }
}
