import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantMembershipsForUser } from "@/server/firebase/tenants";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const user = await getCurrentFirebaseUser();
  if (!user) redirect("/login");
  const profile = await firebaseAdmin().db.collection("users").doc(user.uid).get();
  if (profile.data()?.mustChangePassword !== true) {
    const memberships = await getTenantMembershipsForUser(user.uid);
    redirect(memberships[0] ? `/app/${memberships[0].slug}` : "/onboarding");
  }
  return <Card hoverLift={false} className="w-full max-w-[28rem] space-y-5 p-6"><div><h1 className="font-headline-lg-mobile text-headline-lg-mobile">Creá tu contraseña</h1><p className="mt-1 font-body-md text-body-md text-on-surface-variant">La clave que recibiste era provisoria. Elegí una personal antes de entrar al panel.</p></div><ChangePasswordForm /></Card>;
}
