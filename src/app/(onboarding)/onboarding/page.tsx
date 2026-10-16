import { redirect } from "next/navigation";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { isGender } from "@/lib/gender";
import { todayISO } from "@/lib/dates";
import { Wizard, type OwnerDefaults } from "./wizard";

const BUSINESS_TYPES = [
  { id: "cosmiatria", name: "Cosmiatría y estética", slug: "cosmiatria", icon: "auto_awesome", hint: "Faciales, depilación, tratamientos" },
  { id: "unas", name: "Uñas y pestañas", slug: "unas", icon: "back_hand", hint: "Manicuría, kapping, lifting" },
  { id: "peluqueria", name: "Peluquería", slug: "peluqueria", icon: "brush", hint: "Cortes, color, peinados" },
  { id: "barberia", name: "Barbería", slug: "barberia", icon: "content_cut", hint: "Cortes, barba, perfilado" },
  { id: "spa", name: "Spa y masajes", slug: "spa", icon: "spa", hint: "Masajes, relax, bienestar" },
];

export default async function OnboardingPage() {
  const user = await getCurrentFirebaseUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/onboarding")}`);

  // Lo que ya sabemos de la dueña (registro, o un local anterior) llega
  // precargado al paso "Vos": que solo tenga que confirmar.
  const profile = (await firebaseAdmin().db.collection("users").doc(user.uid).get()).data() ?? {};
  const currentYear = Number(todayISO("America/Argentina/Buenos_Aires").slice(0, 4));
  const birthYear = typeof profile.birthYear === "number" ? profile.birthYear : null;
  const owner: OwnerDefaults = {
    fullName: String(profile.fullName ?? user.name ?? "").trim(),
    email: String(profile.contactEmail ?? profile.email ?? user.email ?? "").trim(),
    gender: isGender(profile.gender) ? profile.gender : null,
    age: birthYear ? String(currentYear - birthYear) : "",
    avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : null,
  };

  return <Wizard businessTypes={BUSINESS_TYPES} owner={owner} />;
}
