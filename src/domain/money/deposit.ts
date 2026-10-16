/**
 * Cálculo de seña de un turno (plan maestro, sección 5.4).
 * Seña = deposit_value (% o fijo), nunca menor a deposit_min y nunca mayor
 * al precio del servicio (una seña fija de $10.000 en un servicio de $6.000
 * cobraría de más).
 * No importa Next ni la base de datos: función pura, testeable sin infraestructura.
 */
export type DepositPolicy =
  | { type: "none" }
  | { type: "percent"; value: number; min: number }
  | { type: "fixed"; value: number; min: number };

export function calculateDeposit(
  totalAmount: number,
  policy: DepositPolicy,
): number {
  if (policy.type === "none") return 0;

  const raw =
    policy.type === "percent"
      ? totalAmount * (policy.value / 100)
      : policy.value;

  return Math.min(Math.max(0, totalAmount), Math.max(raw, policy.min));
}
