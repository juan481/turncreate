import { getPublicTenant } from "./actions";
import { notFound } from "next/navigation";
import { BookingFlow } from "./booking-flow";

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

  return (
    <BookingFlow
      tenantId={tenant.id}
      slug={slug}
      timezone={tenant.timezone || "America/Argentina/Buenos_Aires"}
      rescheduleFrom={rescheduleFrom}
    />
  );
}
