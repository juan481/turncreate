import { Logo } from "@/components/ui/logo";
import { StatusPill } from "@/components/ui/status-pill";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border bg-primary px-gutter">
        <div className="flex items-center gap-3">
          <Logo className="h-6 w-auto [&_text]:fill-white [&_tspan]:fill-[#C4B5FD]" />
          <span className="font-label-sm text-label-sm text-white/70">
            Consola de plataforma
          </span>
        </div>
        <StatusPill status="alert">Acceso restringido · 2FA</StatusPill>
      </header>
      <main className="flex-1 px-gutter py-lg">{children}</main>
    </div>
  );
}
