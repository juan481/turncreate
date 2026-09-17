import { createClient } from "@/server/supabase/server";

/**
 * Sección 4.3: "Acceso: tabla platform_admins, verificación en middleware
 * y en cada ruta." Usa el cliente normal (respeta RLS) -- la policy
 * platform_admins_select ya permite a un usuario ver si ÉL MISMO es
 * platform_admin, así que no hace falta la service role para esto.
 *
 * Se llama tanto en el layout de /platform (protege la navegación) como
 * dentro de cada Server Action que use createAdminClient() (defensa en
 * profundidad: una Server Action es un endpoint invocable directamente,
 * no solo alcanzable navegando la UI que la referencia).
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data !== null;
}

export async function requirePlatformAdmin(): Promise<void> {
  if (!(await isPlatformAdmin())) {
    throw new Error("Sin permiso: se requiere ser platform_admin");
  }
}
