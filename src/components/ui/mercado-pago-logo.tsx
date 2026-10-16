import { cn } from "@/lib/utils";

const MP_LIGHT_BLUE = "#00B1EA";
const MP_DARK_BLUE = "#2D3277";

/**
 * Isotipo de Mercado Pago (apretón de manos en el óvalo celeste) en SVG
 * inline, sin pedir ningún asset. `withWordmark` suma "mercado pago" al
 * lado para los lugares donde la marca es protagonista (Configuración).
 * Por default es decorativo: el texto del botón/título ya dice "Mercado Pago".
 */
export function MercadoPagoLogo({
  className,
  withWordmark = false,
  label,
}: {
  className?: string;
  withWordmark?: boolean;
  /** Si se pasa, el logo se anuncia (role="img") en vez de quedar oculto. */
  label?: string;
}) {
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)} {...a11y}>
      <svg viewBox="0 0 48 32" className="h-[1.25em] w-auto" focusable="false">
        <ellipse cx="24" cy="16" rx="22.5" ry="14.5" fill={MP_LIGHT_BLUE} stroke={MP_DARK_BLUE} strokeWidth="2" />
        <path
          d="M8.5 16.6c3.1-2.7 6.4-4.5 9.7-4.5 2 0 3.4.8 5.1 2.1l3.1 2.3c1 .7 2.4.5 3.1-.5.6-.9.4-2.1-.5-2.7l-2.4-1.8c2.3-.8 4.8-.6 7.2.7 1.9 1 3.6 2.4 5.3 4.1"
          fill="none"
          stroke="#fff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.6 19.2l2.6 2.3M17.4 17.6l3 2.7M21.3 16.9l2.9 2.6M25.4 17.6l1.9 1.7" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
      {withWordmark && (
        <span className="flex flex-col font-bold lowercase leading-[0.9] tracking-tight" style={{ color: MP_DARK_BLUE, fontSize: "0.72em" }}>
          <span>mercado</span>
          <span>pago</span>
        </span>
      )}
    </span>
  );
}
