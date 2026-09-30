import { Wizard } from "./wizard";

const BUSINESS_TYPES = [
  { id: "cosmiatria", name: "Cosmiatría y estética", slug: "cosmiatria" },
  { id: "barberia", name: "Barbería", slug: "barberia" },
  { id: "peluqueria", name: "Peluquería", slug: "peluqueria" },
  { id: "unas", name: "Uñas y pestañas", slug: "unas" },
  { id: "spa", name: "Spa y masajes", slug: "spa" },
];

export default function OnboardingPage() {
  return <Wizard businessTypes={BUSINESS_TYPES} />;
}
