import "server-only";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/server/platform";

/**
 * Piezas compartidas por las Server Actions de (platform). Viven acá y no
 * en los archivos "use server" porque esos solo pueden exportar funciones
 * async (cada export es un endpoint).
 */

export type PlatformActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Error con mensaje apto para mostrarle al admin (el resto se loguea y sale genérico). */
export class PlatformActionError extends Error {}

export type Actor = { uid: string; email: string };

/**
 * Primera línea de TODA acción de esta sección: una Server Action es un
 * endpoint público (se puede invocar sin pasar por la pantalla), así que
 * el permiso se chequea adentro, no solo en el layout/página.
 */
export async function platformActor(): Promise<Actor | null> {
  try {
    const user = await requirePlatformAdmin();
    return { uid: user.uid, email: user.email ?? "" };
  } catch {
    return null;
  }
}

export function revalidateTenantViews(tenantId: string, slug: string) {
  revalidatePath("/platform");
  revalidatePath(`/platform/${tenantId}`);
  revalidatePath("/platform/auditoria");
  if (slug) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/app/${slug}`, "layout");
  }
}

export function failure(error: unknown, fallback: string): PlatformActionResult {
  if (error instanceof PlatformActionError) return { ok: false, error: error.message };
  console.error("[platform]", error);
  return { ok: false, error: fallback };
}
