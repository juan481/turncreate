import { getPublicTenant } from "./actions";
import { notFound } from "next/navigation";
import { BookingFlow } from "./booking-flow";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export default async function PublicBookingPage({
  params,
}: PageProps<"/[slug]">) {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);

  if (!tenant) {
    notFound();
  }

  if (!tenant.booking_enabled) {
    return <Card hoverLift={false} className="mx-auto max-w-[30rem] space-y-4 p-6 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-container-low text-primary"><Icon name="event_busy" className="text-[26px]" /></span><h1 className="font-headline-lg-mobile text-headline-lg-mobile">Reservas online en preparación</h1><p className="font-body-md text-body-md text-on-surface-variant">{tenant.name} todavía no habilitó las reservas online. Podés comunicarte directamente con el negocio para pedir un turno.</p></Card>;
  }

  return (
    <div className="booking-shell space-y-lg">
      <div className="booking-intro min-w-0 space-y-1 px-1">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Reservá tu turno online</h1>
        <p className="break-words font-body-md text-body-md text-on-surface-variant">{tenant.description || "Elegí el servicio, la fecha y el horario que prefieras. Confirmás la reserva pagando la seña al final."}</p>
      </div>
      <BookingFlow
        tenantId={tenant.id}
        slug={slug}
        timezone={tenant.timezone || "America/Argentina/Buenos_Aires"}
        booksByStaff={tenant.books_by_staff}
        maxBookingDays={tenant.max_booking_days}
        paymentMethods={tenant.payment_methods}
        cancellationRefundHours={tenant.cancellation_refund_hours}
        bookableWeekdays={tenant.bookable_weekdays}
      />
    </div>
  );
}
