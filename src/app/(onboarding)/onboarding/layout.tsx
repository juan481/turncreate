import { Logo } from "@/components/ui/logo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center gap-xl px-margin py-2xl">
      <Logo className="h-7 w-auto" />
      <div className="w-full max-w-[32rem]">{children}</div>
    </div>
  );
}
