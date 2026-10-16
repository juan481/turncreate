/**
 * Reglas puras del flujo "Nuevo turno", compartidas por la página
 * (servidor, para calcular los horarios iniciales) y el stepper (cliente)
 * -- tienen que dar EXACTAMENTE lo mismo de los dos lados: si no, el
 * profesional que el servidor usó para listar horarios no coincidiría con
 * el que muestra el formulario.
 */

export type StaffOption = { id: string; displayName: string; photoUrl: string | null; serviceIds: string[] };
export type ServiceOption = { id: string; name: string; price: number };
export type DepositRule = { type: "none" | "fixed" | "percent"; value: number; min: number };

/**
 * Profesionales que pueden atender el servicio (staff.serviceIds, mismo
 * criterio que getEligibleStaffIds en booking.ts). Si NADIE lo tiene
 * asignado (datos viejos sin serviceIds), se ofrece todo el equipo como
 * antes -- pero sin "Cualquiera", porque la asignación automática del
 * servidor solo busca entre los asignados y fallaría.
 */
export function eligibleStaffFor(staff: StaffOption[], serviceId: string): { options: StaffOption[]; allowAny: boolean } {
  if (!serviceId) return { options: staff, allowAny: false };
  const strict = staff.filter((s) => s.serviceIds.includes(serviceId));
  if (strict.length === 0) return { options: staff, allowAny: false };
  return { options: strict, allowAny: strict.length > 1 };
}

/** ¿Hace falta preguntar "¿con quién?"? No, si hay un solo profesional posible. */
export function needsStaffStep(staff: StaffOption[], serviceId: string): boolean {
  return eligibleStaffFor(staff, serviceId).options.length !== 1;
}

/**
 * Profesional efectivo para (servicio, elección actual): con uno solo
 * posible se asigna directo; si la elección actual ya no aplica al
 * servicio nuevo, se limpia ("" = falta elegir).
 */
export function resolveStaffId(staff: StaffOption[], serviceId: string, current: string | undefined): string {
  const { options, allowAny } = eligibleStaffFor(staff, serviceId);
  if (options.length === 1) return options[0].id;
  if (current === "any") return allowAny ? "any" : "";
  if (current && options.some((s) => s.id === current)) return current;
  return "";
}

/** Seña sugerida según la configuración del local (mismo cálculo que había en la página). */
export function suggestedDepositFor(price: number, rule: DepositRule): number {
  if (rule.type === "percent") return Math.max(Math.round((price * rule.value) / 100), rule.min);
  if (rule.type === "fixed") return Math.max(rule.value, rule.min);
  return 0;
}
