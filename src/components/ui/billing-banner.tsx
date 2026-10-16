import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { MercadoPagoLogo } from "./mercado-pago-logo";

/**
 * Aviso de la suscripción del local, arriba de TODAS las pantallas del panel
 * (lo monta el layout del tenant, dentro de <main>: queda debajo del AppBar
 * sticky, nunca lo tapa). Sin "use client": se renderiza en el servidor.
 *
 * - "readonly": cartel rojo grande + botón "Pagar con Mercado Pago". El
 *   panel sigue dejando mirar, eso se aclara abajo del botón.
 * - "grace":    tira ámbar con link "Pagar".
 * - "trial":    tira suave (fin de la prueba cerca) con link "Ver planes".
 *
 * A 320px: el texto envuelve (min-w-0) y el link compacto no se achica
 * (shrink-0); el botón del cartel rojo es de ancho completo.
 */
export function BillingBanner({
  kind,
  message,
  href,
  className,
}: {
  kind: "readonly" | "grace" | "trial";
  message: string;
  /** Pantalla de pago (Mi plan). */
  href: string;
  className?: string;
}) {
  if (kind === "readonly") {
    return (
      <section
        role="alert"
        aria-label="Turnero interrumpido"
        className={cn("min-w-0 space-y-3 rounded-card border-2 border-status-alert/40 bg-status-alert-bg p-4 sm:p-lg", className)}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-status-alert text-[20px] text-on-primary">
            <Icon name="block" />
          </span>
          <p className="min-w-0 flex-1 font-label-lg text-label-lg text-status-alert sm:font-headline-sm sm:text-headline-sm">{message}</p>
        </div>
        <Link
          href={href}
          className="flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-pill bg-status-alert px-4 font-label-lg text-label-lg text-on-primary shadow-card transition-transform active:scale-[0.98] sm:w-auto sm:px-6"
        >
          <MercadoPagoLogo chip className="text-[18px]" />
          <span className="min-w-0 truncate">Pagar con Mercado Pago</span>
        </Link>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Mientras tanto podés seguir viendo tus turnos y clientes, pero no cargar ni cambiar nada. Tu link de reservas no toma turnos nuevos.
        </p>
      </section>
    );
  }

  const grace = kind === "grace";
  return (
    <div
      role={grace ? "alert" : "status"}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-inner py-1 pl-3 pr-1",
        grace ? "bg-status-draft-bg text-status-draft" : "bg-secondary-soft text-primary",
        className,
      )}
    >
      <Icon name={grace ? "warning" : "hourglass_top"} className="shrink-0 text-[18px]" />
      <p className="min-w-0 flex-1 py-1.5 font-body-sm text-body-sm text-on-surface">{message}</p>
      <Link
        href={href}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-pill px-3 font-label-md text-label-md",
          grace ? "text-status-draft" : "text-primary",
        )}
      >
        {grace ? "Pagar" : "Ver planes"}
        <Icon name="chevron_right" className="text-[16px]" />
      </Link>
    </div>
  );
}
