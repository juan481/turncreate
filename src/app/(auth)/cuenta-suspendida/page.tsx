import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { signOut } from "../../(app)/app/[tenant]/actions";

// Destino de requireTenantPage cuando el local está apagado desde /platform.
// No lee datos: solo explica y ofrece contactar a soporte.
const SUPPORT_WHATSAPP = `https://wa.me/541124527669?text=${encodeURIComponent("Hola, mi cuenta de TurnCreate figura suspendida y quiero reactivarla.")}`;

export default function CuentaSuspendidaPage() {
  return (
    <Card hoverLift={false} className="w-full max-w-[28rem] space-y-4 p-lg text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-status-alert-bg text-status-alert">
        <Icon name="lock" className="text-[26px]" />
      </span>
      <h1 className="font-headline-md text-headline-md text-on-surface">Tu cuenta está suspendida</h1>
      <p className="font-body-md text-body-md text-on-surface-variant">
        Por ahora no podés usar el panel y tu turnero no toma reservas. Tus datos siguen guardados: escribinos y lo resolvemos.
      </p>
      <a
        href={SUPPORT_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-pill bg-primary px-4 font-label-lg text-label-lg text-on-primary"
      >
        <Icon name="chat" className="text-[18px]" />
        Hablar con soporte
      </a>
      <form action={signOut}>
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center rounded-pill font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
          Cerrar sesión
        </button>
      </form>
    </Card>
  );
}
