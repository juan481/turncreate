import { getPublicTenant } from "./actions";
import { notFound } from "next/navigation";
import { BookingFlow } from "./booking-flow";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export default async function PublicBookingPage({
  params,
  searchParams,
}: PageProps<"/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const tenant = await getPublicTenant(slug);

  if (!tenant) {
    notFound();
  }

  const rescheduleFrom = typeof sp.rescheduleFrom === "string" ? sp.rescheduleFrom : undefined;

  if (!tenant.booking_enabled) {
    return <Card hoverLift={false} className="mx-auto max-w-[30rem] space-y-4 p-6 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-container-low text-primary"><Icon name="event_busy" className="text-[26px]" /></span><h1 className="font-headline-lg-mobile text-headline-lg-mobile">Reservas online en preparación</h1><p className="font-body-md text-body-md text-on-surface-variant">{tenant.name} todavía no habilitó el pago de la seña. Podés comunicarte directamente con el negocio para pedir un turno.</p></Card>;
  }

  return (
    <BookingFlow
      tenantId={tenant.id}
      slug={slug}
      timezone={tenant.timezone || "America/Argentina/Buenos_Aires"}
      rescheduleFrom={rescheduleFrom}
    />
  );
}
