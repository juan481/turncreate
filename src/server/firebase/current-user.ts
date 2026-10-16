import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { FIREBASE_SESSION_COOKIE, verifyFirebaseSession } from "./session";

// `cache`: layout + página + helpers verifican la cookie (con checkRevoked,
// que pega a Firebase) una sola vez por request en vez de una por llamada.
export const getCurrentFirebaseUser = cache(async () => {
  const session = (await cookies()).get(FIREBASE_SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    return await verifyFirebaseSession(session);
  } catch {
    return null;
  }
});
