import Link from "next/link";
import { addMonthsISO, dayRange, formatTimeInTz, longDayLabel, monthRange, todayISO, weekRange } from "@/lib/dates";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getTenantBySlugFromFirebase } from "@/server/firebase/tenants";
import { getDaySummary, getPaymentSummary, getRangeSummary } from "@/server/firebase/stats";
import { Card } from "@/components/ui/card";
import { MenuTile } from "@/components/ui/menu-tile";
import { Icon } from "@/components/ui/icon";
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

function Stat({ label, value, hint, hintTone = "neutral" }: { label: string; value: string | number; hint?: string; hintTone?: "neutral" | "positive" | "warning" }) {
  return (
    <div className="min-w-0 bg-surface-container-lowest px-4 py-3">
      <p className="truncate font-label-xs text-label-xs uppercase tracking-wide text-on-surface-variant">{label}</p>
      <p className="mt-0.5 truncate font-headline-sm text-headline-sm tabular-nums text-on-surface">{value}</p>
      {hint && (
        <p className={cn("truncate font-label-xs text-label-xs", hintTone === "positive" ? "text-status-confirmed" : hintTone === "warning" ? "text-status-draft" : "text-on-surface-variant")}>
          {hint}
        </p>
      )}
    </div>
  );
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

  const upcoming = daySummary.appointments.filter((a) => a.status === "confirmed" && isUpcoming(a.startsAt)).slice(0, 8);
  const atendidosHoy = daySummary.appointments.filter((a) => a.status === "completed").length;

  const logoUrl = (tenant as typeof tenant & { logoUrl?: string | null }).logoUrl ?? null;
  const mpConnected = mpConnection?.status === "connected";
  const setupSteps = [
    { label: "Cargá tu logo", done: Boolean(logoUrl), href: `/app/${tenantSlug}/configuracion` },
    { label: "Cargá tus servicios y precios", done: servicesCount > 0, href: `/app/${tenantSlug}/servicios` },
    { label: "Conectá tu cuenta de Mercado Pago", done: mpConnected, href: `/app/${tenantSlug}/configuracion#mercadopago` },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;

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

      {/* Contadores: chicos y en una sola tarjeta, para que la pantalla no
          se la coman los números. `gap-px` sobre `bg-border` dibuja las
          líneas divisorias sin bordes por celda. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border shadow-card lg:grid-cols-4">
        <Stat
          label="Cobrado hoy"
          value={`$${todayPayments.applied.toLocaleString("es-AR")}`}
          hint={daySummary.porCobrar > 0 ? `$${daySummary.porCobrar.toLocaleString("es-AR")} por cobrar` : undefined}
        />
        <Stat
          label="Turnos hoy"
          value={daySummary.turnos}
          hint={atendidosHoy > 0 ? `${atendidosHoy} atendido${atendidosHoy === 1 ? "" : "s"}` : undefined}
        />
        <Stat
          label="Esta semana"
          value={`$${weekPayments.applied.toLocaleString("es-AR")}`}
          hint={`${weekSummary.turnos} turno${weekSummary.turnos === 1 ? "" : "s"}`}
        />
        <Stat
          label="Este mes"
          value={`$${monthPayments.applied.toLocaleString("es-AR")}`}
          hint={monthChangePct === null ? undefined : `${monthChangePct >= 0 ? "+" : ""}${monthChangePct}% vs. mes pasado`}
          hintTone={monthChangePct === null ? "neutral" : monthChangePct >= 0 ? "positive" : "warning"}
        />
      </div>

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
