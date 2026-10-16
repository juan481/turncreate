import Image from "next/image";
import { cn } from "@/lib/utils";

/** Firma de la agencia al pie de cada pantalla (admin, onboarding y turnero público). */
export function JustCreateFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("flex justify-center px-4 pb-6 pt-8", className)}>
      <a
        href="https://justcreate.com.ar"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-label-sm text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <Image src="/brand/just-create-icon.png" alt="" width={18} height={18} className="h-[18px] w-[18px] shrink-0 rounded-[4px]" unoptimized />
        <span className="min-w-0 truncate">Desarrollado y diseñado por Just Create</span>
      </a>
    </footer>
  );
}
