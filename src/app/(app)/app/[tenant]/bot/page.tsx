import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";

const UPCOMING = [
  {
    icon: "bolt",
    title: "Aviso instantáneo",
    body: "Apenas entra un turno nuevo (desde el panel o el turnero público), el profesional que lo atiende recibe un WhatsApp con cliente, servicio, día y hora.",
  },
  {
    icon: "notifications_active",
    title: "Recordatorio del día anterior",
    body: "La noche antes, cada profesional recibe un resumen de los turnos del día siguiente -- sin tener que abrir la agenda.",
  },
  {
    icon: "summarize",
    title: "Resumen diario",
    body: "A primera hora, un mensaje con cuántos turnos hay hoy, cuánto se espera facturar y si hay algún hueco libre para ofrecer.",
  },
];

export default function BotPage() {
  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">IA · Bot</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Un asistente que le avisa solo a cada profesional cuando tiene turno.
          </p>
        </div>
        <StatusPill status="draft">En desarrollo</StatusPill>
      </div>

      <Card hoverLift={false} className="space-y-md p-xl">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-soft text-secondary">
            <Icon name="smart_toy" className="text-[18px]" />
          </span>
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Todavía lo estamos construyendo</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Esta sección queda reservada para cuando esté listo -- no hace falta que hagas nada.
            </p>
          </div>
        </div>

        {/* Mockup de cómo se va a ver el aviso por WhatsApp */}
        <div className="rounded-inner bg-surface-container-low p-lg">
          <p className="mb-2 flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name="chat" className="text-[14px]" />
            Así se va a ver
          </p>
          <div className="max-w-[20rem] rounded-card rounded-tl-none bg-[#DCF8C6] p-3 font-body-sm text-body-sm text-[#1b1b1b] shadow-sm">
            Tenés un turno nuevo ✂️
            <br />
            <strong>Agustina Rey</strong> · Manicuría semipermanente
            <br />
            Hoy 15:00 hs
          </div>
        </div>
      </Card>

      <div className="space-y-sm">
        {UPCOMING.map((item) => (
          <Card key={item.title} hoverLift={false} className="flex items-start gap-3 p-lg">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
              <Icon name={item.icon} className="text-[18px]" />
            </span>
            <div>
              <p className="font-label-lg text-label-lg text-on-surface">{item.title}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{item.body}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
