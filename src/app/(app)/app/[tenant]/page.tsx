import Link from "next/link";
import { addMonthsISO, dayRange, formatTimeInTz, longDayLabel, monthRange, todayISO, weekRange } from "@/lib/dates";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { getUserProfileSnapshot } from "@/server/firebase/user-profile";
import { getDaySummary, getPaymentSummary, getRangeSummary } from "@/server/firebase/stats";
import { Card } from "@/components/ui/card";
import { MenuTile } from "@/components/ui/menu-tile";
import { KpiTile } from "@/components/ui/kpi-tile";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { TenantTypeInfoButton } from "./tenant-type-info";
import { PublicLink } from "./public-link";
import { HomeGreeting } from "./home-greeting";
import { currentDayPart, firstNameOf, greetingLines } from "./greeting";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { DEMO_USER_EMAIL } from "@/lib/demo";
import { getMpConnection } from "@/server/mercadopago/connections";
import { countPendingTransfers } from "@/server/public-booking/transfer";
import { planFeatures } from "@/lib/plans";

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

function money(amount: number): string {
  return `$${amount.toLocaleString("es-AR")}`;
}

/**
 * Plata para los tiles chicos de la grilla 2x2: a 320px cada uno tiene
 * ~105px útiles y "$1.250.000" no entra sin truncar. Desde el millón se
 * abrevia ("$1,25 M"); el valor completo queda en el `title` del tile.
 */
function compactMoney(amount: number): string {
  if (Math.abs(amount) < 1_000_000) return money(amount);
  return `$${(amount / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 2 })} M`;
}

export default async function TenantDashboardPage({
  params,
}: PageProps<"/app/[tenant]">) {
  const { tenant: tenantSlug } = await params;
  const { tenant, user } = await requireTenantPage(tenantSlug);

  const dateISO = todayISO(tenant.timezone);
  const monthISO = dateISO.slice(0, 7);
  const monthFirstDayISO = `${monthISO}-01`;
  const previousMonthFirstDayISO = addMonthsISO(monthFirstDayISO, -1);

  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenant.id);
  const features = planFeatures(tenant);

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
    profileSnapshot,
    pendingTransfers,
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
    features.cashSessions ? tenantRef.collection("cashSessions").where("closedAt", "==", null).limit(1).get() : null,
    getCurrentFirebaseUser(),
    getPaymentSummary(tenant.id, dayRange(dateISO, tenant.timezone)),
    getPaymentSummary(tenant.id, weekRange(dateISO, tenant.timezone)),
    getPaymentSummary(tenant.id, monthRange(monthFirstDayISO, tenant.timezone)),
    getPaymentSummary(tenant.id, monthRange(previousMonthFirstDayISO, tenant.timezone)),
    getMpConnection(tenant.id),
    getUserProfileSnapshot(user.uid),
    countPendingTransfers(tenant.id),
  ]);

  const isDemoUser = currentUser?.email === DEMO_USER_EMAIL;
  const profile = profileSnapshot.data();
  // Franja del día en la zona del LOCAL (el VPS corre en UTC).
  const dayPart = currentDayPart(tenant.timezone);
  const greeting = greetingLines({
    dayPart,
    firstName: firstNameOf(profile?.fullName) || firstNameOf(user.name),
    gender: profile?.gender,
    tenantName: tenant.name,
  });
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://turn.justcreate.com.ar"}/${tenantSlug}`;

  const totalStaff = staffSnapshot.size;
  const hasMultipleStaff = features.maxStaff > 1 && totalStaff > 1;
  const clientsCount = clientsSnapshot.docs.filter((doc) => !doc.data().archivedAt).length;
  const servicesCount = servicesSnapshot.docs.filter((doc) => !doc.data().archivedAt).length;
  const openCashSession = openCashSnapshot?.docs[0]?.data() ?? null;

  const upcoming = daySummary.appointments.filter((a) => a.status === "confirmed" && isUpcoming(a.startsAt)).slice(0, 8);
  const atendidosHoy = daySummary.appointments.filter((a) => a.status === "completed").length;

  const logoUrl = (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null;
  const mpConnected = mpConnection?.status === "connected";
  const setupSteps = [
    { label: "Cargá tu logo", done: Boolean(logoUrl), href: `/app/${tenantSlug}/configuracion/local` },
    { label: "Cargá tus servicios y precios", done: servicesCount > 0, href: `/app/${tenantSlug}/servicios` },
    { label: "Conectá tu cuenta de Mercado Pago", done: mpConnected, href: `/app/${tenantSlug}/configuracion/pagos` },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;

  const monthChangePct =
    previousMonthPayments.gross > 0
      ? Math.round(((monthPayments.gross - previousMonthPayments.gross) / previousMonthPayments.gross) * 100)
      : monthPayments.gross > 0
        ? 100
        : null;

  return (
    <div className="space-y-lg">
      <HomeGreeting dayPart={dayPart} icon={greeting.icon} title={greeting.title} subtitle={greeting.subtitle} dateLabel={longDayLabel(dateISO)} />

      {/* Señas por transferencia esperando el OK de la dueña: es plata
          trabada y un turno sin confirmar, así que va arriba de todo. */}
      {pendingTransfers > 0 && (
        <Link
          href={`/app/${tenantSlug}/transferencias`}
          className="flex min-h-14 min-w-0 items-center gap-3 rounded-card border border-status-draft-dot/40 bg-status-draft-bg px-4 py-3 shadow-card transition-transform motion-safe:active:scale-[0.99]"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-status-draft-dot text-[20px] text-on-primary">
            <Icon name="account_balance" />
            <span aria-hidden className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-status-alert-dot ring-2 ring-status-draft-bg motion-safe:animate-breathe" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-label-lg text-label-lg text-status-draft">
              Transferencias por confirmar <span className="tabular-nums">({pendingTransfers})</span>
            </span>
            <span className="block truncate font-label-sm text-label-sm text-status-draft/80">Revisá los comprobantes y confirmá las señas</span>
          </span>
          <Icon name="chevron_right" className="shrink-0 text-[20px] text-status-draft" />
        </Link>
      )}

      {setupDone < setupSteps.length && (
        <Card hoverLift={false} className="space-y-3 border-primary/20 bg-primary/5 p-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-headline-sm text-headline-sm text-on-surface">Terminá de preparar tu turnero</p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Tres pasos cortos y ya podés compartir tu link.</p>
            </div>
            <span className="shrink-0 rounded-pill bg-surface px-2.5 py-1 font-label-xs text-label-xs tabular-nums text-secondary">
              {setupDone}/{setupSteps.length}
            </span>
          </div>
          <ol className="space-y-2">
            {setupSteps.map((step, index) => (
              <li key={step.label}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-inner bg-surface px-3 py-2 transition-colors hover:bg-surface-container-low",
                    step.done && "opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-full font-label-md text-label-md tabular-nums",
                      step.done ? "bg-status-confirmed-bg text-status-confirmed" : "bg-primary text-on-primary",
                    )}
                  >
                    {step.done ? <Icon name="check" className="text-[16px]" /> : index + 1}
                  </span>
                  <span className={cn("min-w-0 flex-1 font-label-md text-label-md text-on-surface", step.done && "line-through decoration-on-surface-variant/50")}>
                    {step.label}
                  </span>
                  {!step.done && <Icon name="chevron_right" className="shrink-0 text-[18px] text-on-surface-variant" />}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Métricas: "Cobrado hoy" es la protagonista (degradé, número
          grande, ancho completo en mobile); el resto en 2x2. grid-cols-2
          explícito como base y lg:grid-cols-6 (2 + 4x1) en desktop. */}
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiTile
          emphasis
          className="col-span-2"
          icon={<Icon name="payments" />}
          label="Cobrado hoy"
          value={money(todayPayments.gross)}
          hint={
            daySummary.porCobrar > 0
              ? `${money(daySummary.porCobrar)} por cobrar todavía`
              : daySummary.turnos > 0
                ? "Todo lo de hoy, al día"
                : "Sin turnos para cobrar hoy"
          }
          href={`/app/${tenantSlug}/caja`}
        />
        <KpiTile
          icon={<Icon name="event" />}
          label="Turnos hoy"
          value={daySummary.turnos}
          hint={
            atendidosHoy > 0
              ? `${atendidosHoy} atendido${atendidosHoy === 1 ? "" : "s"}`
              : upcoming.length > 0
                ? `${upcoming.length} por venir`
                : undefined
          }
          href={`/app/${tenantSlug}/agenda`}
        />
        <KpiTile
          icon={<Icon name="pending_actions" />}
          label="Por cobrar"
          value={compactMoney(daySummary.porCobrar)}
          title={money(daySummary.porCobrar)}
          hint="De los turnos de hoy"
          hintTone={daySummary.porCobrar > 0 ? "warning" : "neutral"}
        />
        <KpiTile
          icon={<Icon name="bar_chart" />}
          label="Esta semana"
          value={compactMoney(weekPayments.gross)}
          title={money(weekPayments.gross)}
          hint={`${weekSummary.turnos} turno${weekSummary.turnos === 1 ? "" : "s"}`}
        />
        <KpiTile
          icon={<Icon name="trending_up" />}
          label="Este mes"
          value={compactMoney(monthPayments.gross)}
          title={money(monthPayments.gross)}
          hint={monthChangePct === null ? undefined : `${monthChangePct >= 0 ? "+" : ""}${monthChangePct}% vs. mes pasado`}
          hintTone={monthChangePct === null ? "neutral" : monthChangePct >= 0 ? "positive" : "warning"}
          href={`/app/${tenantSlug}/reportes`}
        />
      </section>

      {/* Turnos pendientes de hoy: tarjetitas verticales (Cliente, Servicio,
          Horario) en una fila que se desliza. Si no queda ninguno, la
          sección directamente no se muestra. */}
      {upcoming.length > 0 && (
        <section className="space-y-2" aria-labelledby="pendientes-hoy">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-1">
              <h2 id="pendientes-hoy" className="font-headline-sm text-headline-sm text-on-surface">Pendientes de hoy</h2>
              {hasMultipleStaff && <TenantTypeInfoButton />}
            </div>
            <Link href={`/app/${tenantSlug}/agenda`} className="shrink-0 font-label-sm text-label-sm text-secondary">
              Ver agenda
            </Link>
          </div>
          <div className="-mx-gutter flex snap-x gap-2.5 overflow-x-auto px-gutter pb-1 [scrollbar-width:none]">
            {upcoming.map((a, index) => (
              <Link
                key={a.id}
                href={`/app/${tenantSlug}/agenda/${a.id}`}
                className={cn(
                  "flex w-[8.75rem] shrink-0 snap-start flex-col gap-1.5 rounded-card border bg-surface-container-lowest p-3 shadow-card transition-transform active:scale-[0.98]",
                  index === 0 ? "border-primary/40" : "border-border",
                )}
              >
                <p className="truncate font-label-lg text-label-lg text-on-surface">{a.clientName}</p>
                <p className="line-clamp-2 min-h-[2.5em] font-body-sm text-body-sm leading-tight text-on-surface-variant">
                  {a.serviceNames}
                  {hasMultipleStaff && a.staffName ? ` · ${a.staffName}` : ""}
                </p>
                <span
                  className={cn(
                    "mt-auto inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 font-label-sm text-label-sm tabular-nums",
                    index === 0 ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface",
                  )}
                >
                  <Icon name="schedule" className="text-[13px]" />
                  {formatTimeInTz(a.startsAt, tenant.timezone)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Botonera -- un solo tap a cada sección, cada una con un dato vivo.
          Misma lógica de base explícita que la grilla de métricas de arriba. */}
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
            !features.cashSessions
              ? `$${todayPayments.gross.toLocaleString("es-AR")} cobrado hoy`
              : openCashSession
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

      {/* Contenido de TurnCreate para la dueña (no del local): aparte de la
          botonera para que no se lea como una sección más del negocio. */}
      <section aria-label="Aprendé y enterate" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MenuTile href={`/app/${tenantSlug}/novedades`} icon={<Icon name="newspaper" />} title="Novedades" subtitle="Lo nuevo de TurnCreate" />
        <MenuTile href={`/app/${tenantSlug}/tutorial`} icon={<Icon name="play_circle" />} title="Tutorial" subtitle="Cómo sacarle el jugo" />
      </section>
    </div>
  );
}
