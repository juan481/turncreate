import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBookingAttempt } from "@/server/mercadopago/checkout";
import { CheckoutStatusRefresh } from "./checkout-status";

export default async function CheckoutResultPage({ params, searchParams }: PageProps<"/[slug]/checkout">) {
  const { slug } = await params;
  const query = await searchParams;
  const attemptId = typeof query.attempt === "string" ? query.attempt : "";
  const attempt = attemptId ? await getBookingAttempt(attemptId, slug) : null;
  if (!attempt) notFound();
  const pending = attempt.status === "created" || attempt.status === "pending";
  const approved = attempt.status === "approved";
  const refundRequired = attempt.status === "refund_required";

  return (
    <div className="mx-auto max-w-[30rem] py-8">
      <CheckoutStatusRefresh active={pending} />
      <Card hoverLift={false} className="space-y-5 p-6 text-center">
        <div className={cn("mx-auto grid h-16 w-16 place-items-center rounded-full", approved ? "bg-status-confirmed-bg text-status-confirmed" : pending ? "bg-status-pending-bg text-status-pending" : "bg-status-alert-bg text-status-alert") }>
          <Icon name={approved ? "check" : pending ? "progress_activity" : "priority_high"} className={cn("text-[30px]", pending && "animate-spin")} />
        </div>
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            {approved ? "¡Turno confirmado!" : pending ? "Estamos verificando tu pago" : refundRequired ? "Necesitamos revisar tu pago" : "El pago no se completó"}
          </h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
            {approved
              ? "Revisá tu email (o WhatsApp, si el local lo tiene configurado) para ver el comprobante de tu reserva."
              : pending
                ? "No cierres esta pantalla. La confirmación suele tardar unos segundos."
                : refundRequired
                  ? "El horario se ocupó antes de que llegara la aprobación. No confirmamos el turno y soporte gestionará la devolución."
                  : "Tu horario no quedó bloqueado. Podés volver e intentarlo nuevamente."}
          </p>
        </div>
        {approved && attempt.appointmentToken ? (
          <Link href={`/${slug}/mi-turno/${attempt.appointmentToken}`} className={buttonVariants()}>Ver mi turno</Link>
        ) : (
          <Link href={`/${slug}`} className={buttonVariants({ variant: "secondary" })}>Volver al turnero</Link>
        )}
      </Card>
    </div>
  );
}
