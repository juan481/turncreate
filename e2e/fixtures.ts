// Constantes del seed (scripts/seed-e2e.cjs) usadas por los specs.
// Si cambiás algo acá, actualizá también el seed -- no hay un import
// compartido porque el seed corre en Node plano (.cjs) antes de que
// exista cualquier build de TypeScript.
export const SLUG = "e2e-nails";
export const OWNER_EMAIL = "e2e-owner@turncreate.test";
export const OWNER_PASSWORD = "Testing2026!";
export const NEW_TEMP_PASSWORD = "Temporal2026!";
export const NEW_VALID_PASSWORD = "Definitiva2026!";

export function primerIngresoEmail(projectName: string) {
  return `e2e-primer-ingreso+${projectName}@turncreate.test`;
}

export const ATTEMPT_IDS = {
  approved: "e2e_attempt_approved",
  rejected: "e2e_attempt_rejected",
  refundRequired: "e2e_attempt_refund_required",
  pending: "e2e_attempt_pending",
} as const;

export async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Hay scroll lateral: desborda ${overflow}px`);
}
