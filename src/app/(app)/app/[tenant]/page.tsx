import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TenantTypeInfoButton } from "./tenant-type-info";

function formatHour(instant: string, timezone: string) {
  const zoned = new TZDate(new Date(instant), timezone);
  return `${zoned.getHours().toString().padStart(2, "0")}:${zoned.getMinutes().toString().padStart(2, "0")}`;
}

const WEEKDAY_LABEL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export default async function TenantDashboardPage({
  params,
}: PageProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const now = new TZDate(new Date(), tenant.timezone);
  const dateISO = format(now, "yyyy-MM-dd");
  const startUTC = new TZDate(`${dateISO}T00:00:00`, tenant.timezone).toISOString();
  const endUTC = new TZDate(`${dateISO}T23:59:59.999`, tenant.timezone).toISOString();

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenant.id);
  const [appointmentSnapshot, staffSnapshot] = await Promise.all([
    tenantRef.collection("appointments").where("startsAt", ">=", new Date(startUTC)).where("startsAt", "<=", new Date(endUTC)).orderBy("startsAt").get(),
    tenantRef.collection("staff").where("active", "==", true).get(),
  ]);
  const appointmentsRaw = appointmentSnapshot.docs.map((doc) => {
    const item = doc.data();
    return { id: doc.id, starts_at: item.startsAt?.toDate?.().toISOString?.() ?? "", status: item.status, total: Number(item.total ?? 0), balance: Number(item.balance ?? 0), clients: { full_name: item.clientName ?? "" }, staff: { display_name: item.staffName ?? "", photo_url: item.staffPhoto ?? null }, appointment_items: Array.isArray(item.items) ? item.items : [] };
  }).filter((item) => item.status === "confirmed" || item.status === "completed");
  const paymentDocs = await Promise.all(appointmentSnapshot.docs.map((doc) => doc.ref.collection("payments").where("status", "==", "approved").get()));
  const paymentsRes = { data: paymentDocs.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data() as { method: string; amount: number })) };
  const totalStaff = staffSnapshot.size;
  const hasMultipleStaff = totalStaff > 1;

  const appointments = appointmentsRaw.map((a) => ({
    id: a.id,
    startsAt: a.starts_at,
    status: a.status,
    total: Number(a.total),
    balance: Number(a.balance),
    clientName: a.clients?.full_name ?? "",
    staffName: a.staff?.display_name ?? "",
    staffPhoto: a.staff?.photo_url ?? null,
    serviceNames: a.appointment_items.map((i) => i.name).join(", "),
  }));

  const turnosHoy = appointments.length;
  const ingresosHoy = appointments.reduce((sum, a) => sum + a.total, 0);
  const pendienteHoy = appointments.reduce((sum, a) => sum + a.balance, 0);
  const cobradoHoy = ingresosHoy - pendienteHoy;
  const ticketPromedio = turnosHoy > 0 ? ingresosHoy / turnosHoy : 0;

  const nowInstant = now.toISOString();
  const proximo = appointments.find((a) => a.status === "confirmed" && a.startsAt >= nowInstant);
  const resto = appointments.filter((a) => a.id !== proximo?.id);

  const weekdayLabel = WEEKDAY_LABEL[now.getDay()];
  const dayLabel = `${weekdayLabel[0].toUpperCase()}${weekdayLabel.slice(1)} ${now.getDate()}`;

  // Top profesional y servicio más pedido del día -- se derivan de los
  // mismos turnos que ya se trajeron, sin queries extra.
  const countBy = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const v of values) {
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  const topStaff = countBy(appointments.map((a) => a.staffName))[0];
  const topStaffPhoto = topStaff ? appointments.find((a) => a.staffName === topStaff[0])?.staffPhoto ?? null : null;
  const topService = countBy(appointments.map((a) => a.serviceNames))[0];

  const METHOD_LABEL: Record<string, { label: string; icon: string; color: string }> = {
    cash: { label: "Efectivo", icon: "payments", color: "#22C55E" },
    mercadopago: { label: "Mercado Pago", icon: "account_balance_wallet", color: "#00B1EA" },
    card_posnet: { label: "Posnet", icon: "credit_card", color: "#7069E8" },
    transfer: { label: "Transferencia", icon: "swap_horiz", color: "#767582" },
  };
  const paymentsByMethod = new Map<string, number>();
  for (const p of paymentsRes.data) {
    paymentsByMethod.set(p.method, (paymentsByMethod.get(p.method) ?? 0) + Number(p.amount));
  }
  const paymentRows = [...paymentsByMethod.entries()].sort((a, b) => b[1] - a[1]);
  const paymentsTotal = paymentRows.reduce((sum, [, amount]) => sum + amount, 0);

  return (
    <div className="space-y-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
            Hoy en {tenant.name}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{dayLabel}</p>
          <div className="mt-2 flex items-center gap-1.5 rounded-pill bg-surface-container-low px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
            <Icon name={hasMultipleStaff ? "groups" : "person"} className="text-[16px] text-secondary" />
            {hasMultipleStaff ? (
              <span>
                <strong className="text-on-surface">Local de equipo</strong> ({totalStaff} profesionales) — por eso tu agenda se ve en grilla, con una columna por profesional.
              </span>
            ) : (
              <span>
                <strong className="text-on-surface">Local individual</strong> — por eso tu agenda se ve como una lista simple, sin columnas por profesional.
              </span>
            )}
            <TenantTypeInfoButton />
          </div>
        </div>
        <Link href={`/app/${tenantSlug}/agenda/nuevo`} className={buttonVariants({ size: "default" })}>
          <Icon name="add" className="text-[18px]" />
          Nuevo turno
        </Link>
      </div>

      {/* Ingresos hero strip */}
      <Card className="flex flex-col gap-md p-lg md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-label-md text-label-md text-on-surface-variant">Ingresos de hoy</p>
          <p className="font-headline-lg text-headline-lg text-on-surface">
            ${ingresosHoy.toLocaleString("es-AR")}
          </p>
        </div>
        <div className="h-px w-full bg-border md:h-10 md:w-px" />
        <div className="flex flex-col gap-1 font-label-sm text-label-sm">
          <div className="flex items-center gap-1.5 text-status-confirmed">
            <span className="h-1.5 w-1.5 rounded-full bg-status-confirmed-dot" />
            ${cobradoHoy.toLocaleString("es-AR")} cobrado
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            ${pendienteHoy.toLocaleString("es-AR")} a cobrar en caja
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-12 lg:items-start">
        {/* Próximo turno destacado */}
        <div className="lg:col-span-5">
          {proximo ? (
            <Card hoverLift={false} className="relative overflow-hidden border-2 border-secondary/20 p-xl">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-secondary" />
              <div className="mb-md flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-secondary" />
                  <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">
                    Siguiente turno
                  </span>
                </div>
                <span className="rounded-pill bg-surface-container-low px-3 py-0.5 font-headline-sm text-headline-sm text-on-surface">
                  {formatHour(proximo.startsAt, tenant.timezone)} hs
                </span>
              </div>

              <div className="mb-md flex items-center gap-md">
                <Avatar name={proximo.clientName} size="lg" ring />
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">{proximo.clientName}</h2>
                  <p className="font-body-md text-body-md font-medium text-secondary">{proximo.serviceNames}</p>
                </div>
              </div>

              <div className="mb-md grid grid-cols-2 gap-sm rounded-inner bg-surface-container-low p-md">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Con</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Avatar name={proximo.staffName} src={proximo.staffPhoto} size="sm" />
                    <span className="font-label-md text-label-md text-on-surface">{proximo.staffName}</span>
                  </div>
                </div>
                <div className="flex flex-col border-l border-border pl-md">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Saldo</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    {proximo.balance > 0 ? `$${proximo.balance.toLocaleString("es-AR")}` : "Pagado"}
                  </span>
                </div>
              </div>

              <Link
                href={`/app/${tenantSlug}/agenda/${proximo.id}`}
                className={cn(buttonVariants({ size: "default" }), "w-full")}
              >
                Ver detalle del turno
              </Link>
            </Card>
          ) : (
            <Card hoverLift={false} className="flex flex-col items-center gap-2 p-xl text-center">
              <Icon name="event_available" className="text-[32px] text-on-surface-variant" />
              <p className="font-label-lg text-label-lg text-on-surface">Sin más turnos pendientes hoy</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Todo lo agendado para hoy ya fue atendido.
              </p>
            </Card>
          )}
        </div>

        {/* Agenda del dia + KPIs */}
        <div className="flex flex-col gap-md lg:col-span-7">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
            <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
              <p className="font-label-md text-label-md text-on-surface-variant">Turnos hoy</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{turnosHoy}</p>
            </Card>
            <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
              <p className="font-label-md text-label-md text-on-surface-variant">Ticket promedio</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
                ${ticketPromedio.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </p>
            </Card>
            <Card hoverLift={false} className="flex flex-col gap-xs p-lg">
              <p className="font-label-md text-label-md text-on-surface-variant">Por cobrar</p>
              <p className="font-headline-lg-mobile text-headline-lg-mobile text-secondary">
                ${pendienteHoy.toLocaleString("es-AR")}
              </p>
            </Card>
          </div>

          <Card hoverLift={false} className="flex flex-col gap-2 p-lg">
            <h2 className="mb-1 font-headline-sm text-headline-sm text-on-surface">Agenda de hoy</h2>
            {resto.length === 0 && !proximo && (
              <p className="py-4 text-center font-body-sm text-body-sm text-on-surface-variant">
                Todavía no hay turnos confirmados para hoy.
              </p>
            )}
            {resto.map((a) => (
              <Link
                key={a.id}
                href={`/app/${tenantSlug}/agenda/${a.id}`}
                className="flex items-center gap-3 rounded-inner p-2 transition-colors hover:bg-surface-container-low"
              >
                <span className="w-12 shrink-0 font-label-md text-label-md text-on-surface">
                  {formatHour(a.startsAt, tenant.timezone)}
                </span>
                <Avatar name={a.staffName} src={a.staffPhoto} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-label-md text-label-md text-on-surface">{a.clientName}</p>
                  <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{a.serviceNames}</p>
                </div>
                <StatusPill status="confirmed" className="shrink-0">
                  {a.status === "completed" ? "Completado" : "Confirmado"}
                </StatusPill>
              </Link>
            ))}
          </Card>
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-lg", hasMultipleStaff ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {hasMultipleStaff && (
          <Card hoverLift={false} className="flex flex-col gap-md p-lg">
            <p className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
              <Icon name="workspace_premium" className="text-[16px]" />
              Profesional del día
            </p>
            {topStaff ? (
              <div className="flex items-center gap-3">
                <Avatar name={topStaff[0]} src={topStaffPhoto} size="lg" ring />
                <div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">{topStaff[0]}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {topStaff[1]} turno{topStaff[1] === 1 ? "" : "s"} hoy
                  </p>
                </div>
              </div>
            ) : (
              <p className="font-body-sm text-body-sm text-on-surface-variant">Sin turnos todavía.</p>
            )}
          </Card>
        )}

        <Card hoverLift={false} className="flex flex-col gap-md p-lg">
          <p className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
            <Icon name="content_cut" className="text-[16px]" />
            Servicio más pedido hoy
          </p>
          {topService ? (
            <div>
              <p className="font-headline-sm text-headline-sm text-on-surface">{topService[0]}</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {topService[1]} turno{topService[1] === 1 ? "" : "s"}
              </p>
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Sin turnos todavía.</p>
          )}
        </Card>

        <Card hoverLift={false} className="flex flex-col gap-md p-lg">
          <p className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant">
            <Icon name="account_balance_wallet" className="text-[16px]" />
            Cómo pagaron hoy
          </p>
          {paymentRows.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay pagos registrados.</p>
          ) : (
            <div className="space-y-2">
              {paymentRows.map(([method, amount]) => {
                const info = METHOD_LABEL[method] ?? { label: method, icon: "payments", color: "#767582" };
                const pct = paymentsTotal > 0 ? Math.round((amount / paymentsTotal) * 100) : 0;
                return (
                  <div key={method} className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${info.color}1a`, color: info.color }}
                    >
                      <Icon name={info.icon} className="text-[14px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface">
                        <span>{info.label}</span>
                        <span>${amount.toLocaleString("es-AR")}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface-container-low">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: info.color }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
