import { Wizard } from "./wizard";

const BUSINESS_TYPES = [
  { id: "cosmiatria", name: "Cosmiatría y estética", slug: "cosmiatria", icon: "auto_awesome", hint: "Faciales, depilación, tratamientos" },
  { id: "unas", name: "Uñas y pestañas", slug: "unas", icon: "back_hand", hint: "Manicuría, kapping, lifting" },
  { id: "peluqueria", name: "Peluquería", slug: "peluqueria", icon: "brush", hint: "Cortes, color, peinados" },
  { id: "barberia", name: "Barbería", slug: "barberia", icon: "content_cut", hint: "Cortes, barba, perfilado" },
  { id: "spa", name: "Spa y masajes", slug: "spa", icon: "spa", hint: "Masajes, relax, bienestar" },
];

export default function OnboardingPage() {
  return <Wizard businessTypes={BUSINESS_TYPES} />;
}
