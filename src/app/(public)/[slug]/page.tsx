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
    return <Card hoverLift={false} className="mx-auto max-w-[30rem] space-y-4 p-6 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface-container-low text-primary"><Icon name="event_busy" className="text-[26px]" /></span><h1 className="font-headline-lg-mobile text-headline-lg-mobile">Reservas online en preparación</h1><p className="font-body-md text-body-md text-on-surface-variant">{tenant.name} todavía no habilitó el pago de la seña. Podés comunicarte directamente con el negocio para pedir un turno.</p></Card>;
  }

  return (
    <div className="space-y-lg">
      {(tenant.description || tenant.address) && <div className="space-y-1 px-1"><h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">Reservá tu turno</h1>{tenant.description && <p className="font-body-md text-body-md text-on-surface-variant">{tenant.description}</p>}{tenant.address && <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant"><Icon name="location_on" className="text-[16px]" />{tenant.address}</p>}</div>}
      <BookingFlow
        tenantId={tenant.id}
        slug={slug}
        timezone={tenant.timezone || "America/Argentina/Buenos_Aires"}
        booksByStaff={tenant.books_by_staff}
        maxBookingDays={tenant.max_booking_days}
      />
    </div>
  );
}
