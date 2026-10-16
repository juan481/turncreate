import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import { StatusPill, type StatusPillStatus } from "@/components/ui/status-pill";
import { BILLING_STATUS_LABEL, type BillingAccess, type TenantBilling } from "@/lib/billing";
import { PLAN_IDS, PLANS, planFeatures } from "@/lib/plans";
import { getBillingConfig } from "@/server/billing/config";
import { isSubscriptionCheckoutAvailable } from "@/server/billing/subscriptions";
import { readTenantBilling, tenantBillingAccess } from "@/server/billing/tenant-billing";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { ScreenIntro } from "../configuracion/settings-ui";
import { formatMoney } from "../configuracion/summaries";
import { billingDateLabel, billingStatusDetail, planIncludes, staffLimitLabel } from "./billing-copy";
import { CancelSubscription } from "./cancel-subscription";
import { PlanPicker, type PlanOption } from "./plan-picker";
import { SubscribedNotice } from "./subscribed-notice";

const MANAGER_ROLES = new Set(["owner", "admin"]);

// Fuera del componente: el linter de React marca `Date.now()` adentro del render
// (acá es un Server Component: se calcula una vez por request).
function requestTime() {
  return Date.now();
}

function statusTone(access: BillingAccess, billing: TenantBilling): StatusPillStatus {
  if (access.level === "readonly") return "alert";
  if (access.level === "grace") return "draft";
  return billing.status === "active" ? "confirmed" : "pending";
}

/**
 * Mi plan: lo que el local le paga a Just Create por TurnCreate (nada que ver
 * con las señas de las clientas). Débito automático de Mercado Pago
 * (preapproval). Mercado Pago vuelve acá con ?mp=subscribed, pero el estado
 * lo sigue marcando el servidor (webhook), no el parámetro.
 */
export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant: tenantSlug } = await params;
  const { tenant, user, member } = await requireTenantPage(tenantSlug);
  const { mp } = await searchParams;
  const now = requestTime();

  const [config, activeStaffCount] = await Promise.all([
    getBillingConfig(),
    firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("staff").where("active", "==", true).count().get().then((snapshot) => snapshot.data().count),
  ]);
  // Locales anteriores a la suscripción no tienen `billing`: son cortesía.
  const billing: TenantBilling = readTenantBilling(tenant) ?? { status: "free", plan: planFeatures(tenant).id };
  const access = tenantBillingAccess(tenant, now);
  const checkoutAvailable = isSubscriptionCheckoutAvailable();
  const tz = tenant.timezone;

  const plan = PLANS[billing.plan] ?? planFeatures(tenant);
  const price = config.prices[plan.id];
  const canManage = MANAGER_ROLES.has(typeof member.role === "string" ? member.role : "");
  const subscribedAndOk = billing.status === "active" && access.level === "full";
  const canSubscribe = canManage && !subscribedAndOk;
  const canCancel = canManage && (billing.status === "active" || billing.status === "past_due");
  const coveredUntil = billing.currentPeriodEnd != null && billing.currentPeriodEnd > now ? billingDateLabel(billing.currentPeriodEnd, tz, now) : null;

  const options: PlanOption[] = PLAN_IDS.map((id) => ({
    id,
    name: PLANS[id].name,
    price: formatMoney(config.prices[id]),
    staffLabel: staffLimitLabel(id),
    maxStaff: PLANS[id].maxStaff,
  }));

  const ctaHint =
    billing.status === "free"
      ? "Es opcional: con la cortesía no pagás nada. Si querés, ya podés dejar el débito automático armado."
      : billing.status === "trial" && access.level === "full"
        ? "Si te suscribís ahora, tu turnero sigue andando sin cortes cuando termine la prueba."
        : undefined;

  return (
    <div className="mx-auto max-w-[42rem] space-y-lg">
      <ScreenIntro title="Mi plan" description="Lo que pagás por TurnCreate y cómo se cobra." />

      {mp === "subscribed" && <SubscribedNotice />}

      <Card hoverLift={false} className="min-w-0 space-y-md p-lg sm:p-xl">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-soft text-[20px] text-secondary">
            <Icon name="workspace_premium" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-label-md text-label-md text-on-surface-variant">Tu plan</p>
            <h2 className="truncate font-headline-sm text-headline-sm text-on-surface">Plan {plan.name}</h2>
            {/* Debajo del título y no al costado: "Interrumpido por falta de
                pago" no entra al lado del nombre a 320px. */}
            <StatusPill status={statusTone(access, billing)} className="mt-1.5">
              {BILLING_STATUS_LABEL[billing.status]}
            </StatusPill>
          </div>
        </div>

        <p className="font-body-md text-body-md text-on-surface">{billingStatusDetail(billing, access, tz, now)}</p>

        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="min-w-0 rounded-inner bg-surface-container-low px-3 py-2.5">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Valor del plan</dt>
            <dd className="tabular-nums">
              <span className="font-headline-sm text-headline-sm text-on-surface">{formatMoney(price)}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant"> /mes</span>
              {billing.status === "free" && <span className="block font-body-sm text-body-sm text-status-confirmed">Hoy no pagás nada</span>}
            </dd>
          </div>
          <div className="min-w-0 rounded-inner bg-surface-container-low px-3 py-2.5">
            <dt className="font-label-sm text-label-sm text-on-surface-variant">Cómo se cobra</dt>
            <dd className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface">
              <MercadoPagoLogo className="text-[18px]" />
              <span className="min-w-0 truncate" title={billing.payerEmail ?? undefined}>
                {billing.payerEmail && (billing.status === "active" || billing.status === "past_due") ? billing.payerEmail : "Débito automático mensual"}
              </span>
            </dd>
          </div>
        </dl>

        <div className="space-y-2">
          <p className="font-label-lg text-label-lg text-on-surface">Qué incluye</p>
          <ul className="space-y-1.5">
            {planIncludes(plan.id).map((item) => (
              <li key={item} className="flex min-w-0 items-start gap-2 font-body-md text-body-md text-on-surface">
                <Icon name="check" className="mt-0.5 shrink-0 text-[18px] text-status-confirmed" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {canCancel && (
          <div className="border-t border-border pt-md">
            <CancelSubscription tenantSlug={tenant.slug} coveredUntilLabel={coveredUntil} />
          </div>
        )}
      </Card>

      <section id="suscribirme" className="scroll-mt-24 space-y-md lg:scroll-mt-32">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">{subscribedAndOk ? "Planes" : "Elegí tu plan"}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Los tres traen el link de reservas. Cambia cuántas personas pueden tener agenda y la caja con arqueo.
          </p>
        </div>

        <PlanPicker
          tenantSlug={tenant.slug}
          options={options}
          currentPlan={plan.id}
          canSubscribe={canSubscribe}
          checkoutAvailable={checkoutAvailable}
          defaultEmail={billing.payerEmail ?? user.email ?? ""}
          activeStaffCount={activeStaffCount}
          ctaHint={ctaHint}
        />

        {!canManage && (
          <p className="flex min-w-0 gap-2 rounded-inner bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="lock" className="mt-0.5 shrink-0 text-[16px]" />
            <span className="min-w-0">Solo la dueña o quien administra el local puede suscribirse o cambiar el plan.</span>
          </p>
        )}
        {canManage && subscribedAndOk && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">¿Querés pasarte a otro plan? Escribinos desde Ayuda y lo cambiamos sin cortar tu turnero.</p>
        )}
      </section>
    </div>
  );
}
