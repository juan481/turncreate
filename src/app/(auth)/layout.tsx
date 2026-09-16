import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-margin py-2xl">
      <Link href="/">
        <Logo className="h-8 w-auto" />
      </Link>
      {children}
    </div>
  );
}
