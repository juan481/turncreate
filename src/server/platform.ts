import "server-only";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";

/**
 * Acceso de plataforma: un único email (PLATFORM_ADMIN_EMAIL) en vez de una
 * colección de admins. Se chequea en el layout de /platform, en CADA
 * page.tsx de esa sección (el notFound() del layout no frena el payload RSC
 * de la página: Next los renderiza en paralelo) y dentro de cada Server
 * Action (una Server Action es un endpoint invocable directamente, no solo
 * alcanzable navegando la UI que la referencia).
 *
 * La comparación ignora mayúsculas/espacios: Firebase guarda el email en
 * minúsculas y el env puede venir tipeado de cualquier forma.
 */
function adminEmail(): string | null {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  return email ? email : null;
}

/**
 * El usuario de la sesión si es el admin de plataforma; null si no (o si no hay sesión).
 *
 * Con PLATFORM_ADMIN_UID se exige el uid exacto: el registro no verifica
 * emails, así que si la cuenta del email admin no existiera, cualquiera
 * podría crearla con ese email y entrar. El uid no se puede elegir.
 */
export async function getPlatformAdmin() {
  const expected = adminEmail();
  if (!expected) return null;
  const user = await getCurrentFirebaseUser();
  if (!user?.email) return null;
  const expectedUid = process.env.PLATFORM_ADMIN_UID?.trim();
  if (expectedUid && user.uid !== expectedUid) return null;
  return user.email.trim().toLowerCase() === expected ? user : null;
}

export async function isPlatformAdmin(): Promise<boolean> {
  return (await getPlatformAdmin()) !== null;
}

/** Tira si no es el admin; si lo es, devuelve el usuario (uid/email para la auditoría). */
export async function requirePlatformAdmin() {
  const user = await getPlatformAdmin();
  if (!user) throw new Error("Sin permiso: se requiere ser platform admin");
  return user;
}
