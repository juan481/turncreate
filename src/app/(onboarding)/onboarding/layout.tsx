import { JustCreateFooter } from "@/components/ui/just-create-footer";
import { Logo } from "@/components/ui/logo";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-margin pt-[calc(2rem+var(--safe-t))]">
      <Logo className="h-7 w-auto shrink-0" />
      <main className="mt-xl w-full min-w-0 max-w-[32rem]">{children}</main>
      <JustCreateFooter className="mt-auto pb-[calc(1.5rem+var(--safe-b))]" />
    </div>
  );
}
