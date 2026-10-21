import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo oficial provisto por Mercado Pago. No se recrea ni se recolorea. */
export function MercadoPagoLogo({
  className,
  chip = false,
  label,
}: {
  className?: string;
  withWordmark?: boolean;
  chip?: boolean;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", chip && "rounded-pill bg-white px-2 py-1", className)}>
      <Image
        src="/brands/mercado-pago.svg"
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        width={160}
        height={65}
        unoptimized
        className="h-[1.5em] w-auto max-w-full object-contain"
      />
    </span>
  );
}
