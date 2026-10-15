import Link from "next/link";
import { addMonthsISO, dayRange, formatTimeInTz, longDayLabel, monthRange, todayISO, weekRange } from "@/lib/dates";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getDaySummary, getPaymentSummary, getRangeSummary } from "@/server/firebase/stats";
import { Card } from "@/components/ui/card";
import { KpiTile } from "@/components/ui/kpi-tile";
import { MenuTile } from "@/components/ui/menu-tile";
import { AppointmentRow } from "@/components/ui/appointment-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TenantTypeInfoButton } from "./tenant-type-info";
import { PublicLink } from "./public-link";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { DEMO_USER_EMAIL } from "@/lib/demo";
import { getMpConnection } from "@/server/mercadopago/connections";

// Fuera del componente a propósito: el linter de React trata cualquier
// `Date.now()` adentro de una función-componente como una llamada impura
// "durante el render" (mismo patrón ya usado en notifications-button.tsx
// para `timeAgo`). Esto además es la comparación por instante real/epoch
// -- nunca por string -- que ya se arregló para "próximo turno": `startsAt`
// viene en UTC ("...Z") desde `getDaySummary`, así que esto es epoch contra
// epoch sin importar la zona del servidor.
function isUpcoming(startsAtISO: string): boolean {
  return new Date(startsAtISO).getTime() >= Date.now();
}

export default async function TenantDashboardPage({
  params,
}: PageProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const tenant = await getTenantBySlugFromFirebase(tenantSlug);
  if (!tenant) return null;

  const dateISO = todayISO(tenant.timezone);
  const monthISO = dateISO.slice(0, 7);
  const monthFirstDayISO = `${monthISO}-01`;
  const previousMonthFirstDayISO = addMonthsISO(monthFirstDayISO, -1);

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenant.id);

  const [
    daySummary,
    weekSummary,
    monthSummary,
    staffSnapshot,
    clientsSnapshot,
    servicesSnapshot,
    openCashSnapshot,
    currentUser,
    todayPayments,
    weekPayments,
    monthPayments,
    previousMonthPayments,
    mpConnection,
  ] = await Promise.all([
    getDaySummary(tenant.id, dateISO, tenant.timezone),
    getRangeSummary(tenant.id, weekRange(dateISO, tenant.timezone)),
    getRangeSummary(tenant.id, monthRange(monthFirstDayISO, tenant.timezone)),
    tenantRef.collection("staff").where("active", "==", true).get(),
    // `archivedAt` no siempre existe en el doc (no es `null`, está AUSENTE
    // en los clientes/servicios activos) -- no se puede filtrar con un
    // `where`, hay que traer y filtrar en memoria. `.select()` para no
    // bajar el resto de los campos: para esta tile solo hace falta contar.
    tenantRef.collection("clients").select("archivedAt").get(),
    tenantRef.collection("services").select("archivedAt").get(),
    // Al abrir caja se crea con `closedAt: null` explícito (no ausente),
    // así que esta sí es una query directa y mínima -- la misma que usa
    // `openCash` en caja/actions.ts para chequear si ya hay una abierta.
    tenantRef.collection("cashSessions").where("closedAt", "==", null).limit(1).get(),
    getCurrentFirebaseUser(),
    getPaymentSummary(tenant.id, dayRange(dateISO, tenant.timezone)),
    getPaymentSummary(tenant.id, weekRange(dateISO, tenant.timezone)),
    getPaymentSummary(tenant.id, monthRange(monthFirstDayISO, tenant.timezone)),
    getPaymentSummary(tenant.id, monthRange(previousMonthFirstDayISO, tenant.timezone)),
    getMpConnection(tenant.id),
  ]);

  const isDemoUser = currentUser?.email === DEMO_USER_EMAIL;
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://turn.justcreate.com.ar"}/${tenantSlug}`;

  const totalStaff = staffSnapshot.size;
  const hasMultipleStaff = totalStaff > 1;
  const clientsCount = clientsSnapshot.docs.filter((doc) => !doc.data().archivedAt).length;
  const servicesCount = servicesSnapshot.docs.filter((doc) => !doc.data().archivedAt).length;
  const openCashSession = openCashSnapshot.docs[0]?.data() ?? null;

  const upcoming = daySummary.appointments.filter((a) => a.status === "confirmed" && isUpcoming(a.startsAt));
  const proximo = upcoming[0] ?? null;
  const siguientes = upcoming.slice(1, 5);
  const atendidosHoy = daySummary.appointments.filter((a) => a.status === "completed").length;

  const monthChangePct =
    previousMonthPayments.applied > 0
      ? Math.round(((monthPayments.applied - previousMonthPayments.applied) / previousMonthPayments.applied) * 100)
      : monthPayments.applied > 0
        ? 100
        : null;

  return (
    <div className="space-y-lg">
      <div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface md:font-headline-lg md:text-headline-lg">
          Hoy en {tenant.name}
        </h1>
        <p className="font-body-sm text-body-sm capitalize text-on-surface-variant">{longDayLabel(dateISO)}</p>
      </div>

      {(servicesCount === 0 || mpConnection?.status !== "connected") && (
        <Card hoverLift={false} className="space-y-3 border-primary/20 bg-primary/5 p-lg">
          <div><p className="font-headline-sm text-headline-sm text-on-surface">TerminÃ¡ de preparar tu turnero</p><p className="font-body-sm text-body-sm text-on-surface-variant">Dos pasos cortos y ya podÃ©s compartir tu link.</p></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`/app/${tenantSlug}/servicios`} className="flex min-h-11 items-center gap-2 rounded-inner bg-surface px-3 font-label-md text-label-md"><Icon name={servicesCount > 0 ? "check_circle" : "radio_button_unchecked"} className={servicesCount > 0 ? "text-status-confirmed" : "text-primary"} />Cargar servicios</Link>
            <Link href={`/app/${tenantSlug}/configuracion`} className="flex min-h-11 items-center gap-2 rounded-inner bg-surface px-3 font-label-md text-label-md"><Icon name={mpConnection?.status === "connected" ? "check_circle" : "radio_button_unchecked"} className={mpConnection?.status === "connected" ? "text-status-confirmed" : "text-primary"} />Conectar Mercado Pago</Link>
          </div>
        </Card>
      )}

      {/* Hero: lo primero que pidió Juan -- cuánta plata entró hoy, sin vueltas */}
      <Card hoverLift={false} className="flex flex-col gap-1 p-lg">
        <p className="font-label-md text-label-md text-on-surface-variant">Hoy llevás cobrados</p>
        <p className="font-headline-lg text-headline-lg tabular-nums text-on-surface">
          ${todayPayments.applied.toLocaleString("es-AR")}
        </p>
        {daySummary.porCobrar > 0 && (
          <p className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
            <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
            ${daySummary.porCobrar.toLocaleString("es-AR")} por cobrar
          </p>
        )}
      </Card>

      {/* 4 KPIs -- grilla 2x2 en mobile, fila en desktop (patrón Perladerm).
          Base `grid-cols-2` a propósito (no `grid-cols-1`): el 2x2 ES el
          diseño pedido para mobile, no un fallback -- la regla del SKILL
          sobre "grid-cols-1 explícito" apunta a grids SIN ninguna columna
          base definida, no a este caso donde la base ya es explícita. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Turnos hoy"
          icon={<Icon name="event" className="text-[14px]" />}
          value={daySummary.turnos}
          hint={atendidosHoy > 0 ? `${atendidosHoy} atendido${atendidosHoy === 1 ? "" : "s"}` : undefined}
        />
        <KpiTile
          label="Facturado hoy"
          icon={<Icon name="payments" className="text-[14px]" />}
          value={`$${daySummary.facturado.toLocaleString("es-AR")}`}
        />
        <KpiTile
          label="Esta semana"
          icon={<Icon name="trending_up" className="text-[14px]" />}
          value={`$${weekPayments.applied.toLocaleString("es-AR")}`}
          hint={`${weekSummary.turnos} turno${weekSummary.turnos === 1 ? "" : "s"}`}
        />
        <KpiTile
          label="Este mes"
          icon={<Icon name="monitoring" className="text-[14px]" />}
          value={`$${monthPayments.applied.toLocaleString("es-AR")}`}
          hint={monthChangePct === null ? undefined : `${monthChangePct >= 0 ? "+" : ""}${monthChangePct}% vs. mes pasado`}
          hintTone={monthChangePct === null ? "neutral" : monthChangePct >= 0 ? "positive" : "warning"}
        />
      </div>

      {/* Próximo turno -- compacto: foto, hora, servicio, profesional si hay equipo, y listo */}
      {proximo ? (
        <Card hoverLift={false} className="flex flex-col gap-md p-lg">
          <div className="flex items-center gap-3">
            <Avatar name={proximo.clientName} src={proximo.clientPhoto} size="lg" ring />
            <div className="min-w-0 flex-1">
              <p className="font-label-sm text-label-sm font-semibold uppercase tracking-wide text-secondary">
                Próximo turno · {formatTimeInTz(proximo.startsAt, tenant.timezone)} hs
              </p>
              <p className="truncate font-headline-sm text-headline-sm text-on-surface">{proximo.clientName}</p>
              <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                {proximo.serviceNames}
                {hasMultipleStaff && proximo.staffName ? ` · ${proximo.staffName}` : ""}
              </p>
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
        <Card hoverLift={false} className="p-lg">
          <EmptyState
            icon={<Icon name="event_available" className="text-[24px]" />}
            title="Sin más turnos pendientes hoy"
            description="Todo lo agendado para hoy ya fue atendido."
          />
        </Card>
      )}

      {/* Tu día -- lo que queda, nada más (lo de atrás ya quedó en el hero + KPIs) */}
      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Tu día</h2>
            {hasMultipleStaff && <TenantTypeInfoButton />}
          </div>
          <Link href={`/app/${tenantSlug}/agenda`} className="shrink-0 font-label-sm text-label-sm text-secondary">
            Ver agenda completa
          </Link>
        </div>
        {siguientes.length === 0 ? (
          <p className="py-2 font-body-sm text-body-sm text-on-surface-variant">
            {proximo
              ? "No hay más turnos después de este."
              : daySummary.turnos > 0
                ? "Ya atendiste todos los turnos de hoy."
                : "Todavía no hay turnos confirmados para hoy."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {siguientes.map((a) => (
              <AppointmentRow
                key={a.id}
                href={`/app/${tenantSlug}/agenda/${a.id}`}
                time={formatTimeInTz(a.startsAt, tenant.timezone)}
                clientName={a.clientName}
                clientPhoto={a.clientPhoto}
                serviceName={a.serviceNames}
                staffName={hasMultipleStaff ? a.staffName : undefined}
                statusTone="confirmed"
                statusLabel="Confirmado"
                price={`$${a.total.toLocaleString("es-AR")}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Botonera -- un solo tap a cada sección, cada una con un dato vivo.
          Misma lógica de base explícita que la grilla de KPIs de arriba. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MenuTile
          href={`/app/${tenantSlug}/agenda`}
          icon={<Icon name="event" />}
          title="Agenda"
          subtitle={`${daySummary.turnos} turno${daySummary.turnos === 1 ? "" : "s"} hoy`}
        />
        <MenuTile
          href={`/app/${tenantSlug}/agenda/mes`}
          icon={<Icon name="calendar_month" />}
          title="Calendario"
          subtitle="Ver mes"
        />
        <MenuTile
          href={`/app/${tenantSlug}/clientes`}
          icon={<Icon name="group" />}
          title="Clientes"
          subtitle={`${clientsCount} cliente${clientsCount === 1 ? "" : "s"}`}
        />
        <MenuTile
          href={`/app/${tenantSlug}/caja`}
          icon={<Icon name="point_of_sale" />}
          title="Caja"
          subtitle={
            openCashSession
              ? `Abierta · $${Number(openCashSession.openingAmount ?? 0).toLocaleString("es-AR")}`
              : "Cerrada"
          }
        />
        <MenuTile
          href={`/app/${tenantSlug}/reportes`}
          icon={<Icon name="monitoring" />}
          title="Reportes"
          subtitle={`$${monthSummary.cobrado.toLocaleString("es-AR")} este mes`}
        />
        <MenuTile
          href={`/app/${tenantSlug}/servicios`}
          icon={<Icon name="content_cut" />}
          title="Servicios"
          subtitle={`${servicesCount} servicio${servicesCount === 1 ? "" : "s"}`}
        />
        {hasMultipleStaff && (
          <MenuTile
            href={`/app/${tenantSlug}/staff`}
            icon={<Icon name="badge" />}
            title="Equipo"
            subtitle={`${totalStaff} profesionales`}
          />
        )}
        <PublicLink
          url={publicUrl}
          copiedMessage={
            isDemoUser
              ? "Probá reservar uno vos mismo/a -- lo vas a ver reflejado en tu agenda al toque."
              : "Link copiado -- compartilo con tus clientes."
          }
        />
        <MenuTile href={`/app/${tenantSlug}/configuracion`} icon={<Icon name="settings" />} title="Configuración" />
        <MenuTile href={`/app/${tenantSlug}/bot`} icon={<Icon name="smart_toy" />} title="IA" subtitle="Beta" />
      </div>
    </div>
  );
}
