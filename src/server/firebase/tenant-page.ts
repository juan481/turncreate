import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentFirebaseUser } from "./current-user";
import { getTenantBySlugFromFirebase, getTenantMember } from "./tenants";

/**
 * Acceso al local para Server Components del admin. El layout de
 * /app/[tenant] NO alcanza: Next renderiza layout y página en paralelo, y
 * el notFound() del layout no impide que los datos de la página viajen en
 * el payload RSC (node_modules/next/dist/docs/01-app/02-guides/authentication.md,
 * "Layouts and auth checks"). Cada página que lee datos del local tiene que
 * pasar por acá. `cache` hace que layout + página compartan una sola
 * verificación por request.
 */
export const requireTenantPage = cache(async (slug: string) => {
  const [tenant, user] = await Promise.all([getTenantBySlugFromFirebase(slug), getCurrentFirebaseUser()]);
  if (!tenant) notFound();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/${slug}`)}`);
  const member = await getTenantMember(user.uid, tenant.id);
  if (!member || member.status !== "active") notFound();
  return { tenant, user, member };
});
