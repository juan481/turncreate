import "server-only";
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
