// Planes tal cual los promete la landing (src/app/(marketing)/page.tsx).
// El link de reservas va en TODOS: es el corazón del producto, no un extra.
export type PlanId = "solo" | "equipo" | "pro";

export type PlanFeatures = {
  id: PlanId;
  name: string;
  /** Profesionales activos permitidos (la dueña cuenta como una). */
  maxStaff: number;
  /** Apertura/cierre de caja con arqueo: tiene sentido con varias personas cobrando. */
  cashSessions: boolean;
  publicBooking: boolean;
};

export const PLANS: Record<PlanId, PlanFeatures> = {
  solo: { id: "solo", name: "Solo", maxStaff: 1, cashSessions: false, publicBooking: true },
  equipo: { id: "equipo", name: "Equipo", maxStaff: 5, cashSessions: true, publicBooking: true },
  pro: { id: "pro", name: "Pro", maxStaff: 15, cashSessions: true, publicBooking: true },
};

function isPlanId(value: unknown): value is PlanId {
  return value === "solo" || value === "equipo" || value === "pro";
}

// Los locales creados antes de que existieran los planes no tienen `plan`:
// se tratan como Equipo para no quitarles nada de lo que ya venían usando.
export function planFeatures(tenant: { plan?: unknown }): PlanFeatures {
  return PLANS[isPlanId(tenant.plan) ? tenant.plan : "equipo"];
}
