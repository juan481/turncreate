import "server-only";
import { cookies } from "next/headers";
import { firebaseAdmin } from "./admin";

export const FIREBASE_SESSION_COOKIE = "turncreate_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

export async function createFirebaseSession(idToken: string) {
  return firebaseAdmin().auth.createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
}

export async function verifyFirebaseSession(sessionCookie: string) {
  return firebaseAdmin().auth.verifySessionCookie(sessionCookie, true);
}

export const firebaseSessionMaxAge = Math.floor(SESSION_DURATION_MS / 1000);

// Firebase revoca (vía checkRevoked) cualquier cookie de sesión emitida
// antes de un cambio de contraseña -- hay que emitir una cookie nueva
// cada vez que se cambia la clave, o la sesión vieja queda inválida y el
// usuario rebota a /login justo después de guardar.
export async function persistFirebaseSession(idToken: string) {
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
