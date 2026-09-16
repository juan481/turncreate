import { Logo } from "@/components/ui/logo";

const PASOS = [
  "Local y rubro",
  "Horarios",
  "Profesionales",
  "Mercado Pago",
  "Listo",
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center gap-2xl px-margin py-2xl">
      <Logo className="h-7 w-auto" />
      <div className="flex w-full max-w-lg items-center gap-1.5">
        {PASOS.map((paso, i) => (
          <div
            key={paso}
            className={`h-1.5 flex-1 rounded-pill ${
              i === 0 ? "bg-secondary" : "bg-surface-muted"
            }`}
          />
        ))}
      </div>
      <div className="w-full max-w-lg">{children}</div>
    </div>
  );
}
