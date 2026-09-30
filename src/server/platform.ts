import "server-only";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";

/**
 * Acceso de plataforma: un único email (PLATFORM_ADMIN_EMAIL) en vez de una
 * colección de admins -- mismo criterio que ya usa toggleTenantStatusAction.
 * Se llama tanto en el layout de /platform (protege la navegación) como
 * dentro de cada Server Action de esa sección (defensa en profundidad: una
 * Server Action es un endpoint invocable directamente, no solo alcanzable
 * navegando la UI que la referencia).
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const user = await getCurrentFirebaseUser();
  if (!user || !process.env.PLATFORM_ADMIN_EMAIL) return false;
  return user.email === process.env.PLATFORM_ADMIN_EMAIL;
}

export async function requirePlatformAdmin(): Promise<void> {
  if (!(await isPlatformAdmin())) {
    throw new Error("Sin permiso: se requiere ser platform admin");
  }
}
