/**
 * Cálculo de seña de un turno (plan maestro, sección 5.4).
 * Seña = deposit_value (% o fijo), nunca menor a deposit_min y nunca mayor
 * al precio del servicio (una seña fija de $10.000 en un servicio de $6.000
 * cobraría de más).
 * No importa Next ni la base de datos: función pura, testeable sin infraestructura.
 */
import { roundMoney } from "./payment";

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

/**
 * Seña cargada a mano (turno manual / reprogramación): nunca negativa ni
 * mayor al precio del servicio (una seña de más deja el saldo en negativo e
 * infla "Cobrado"). Un valor no numérico (NaN/Infinity desde un form
 * adulterado) se rechaza en vez de guardarse.
 */
export function clampDepositToPrice(amount: number | undefined, price: number): number {
  const raw = amount ?? 0;
  if (!Number.isFinite(raw)) throw new Error("El monto de la seña no es válido");
  const cap = Number.isFinite(price) ? Math.max(0, price) : 0;
  const clamped = Math.min(cap, Math.max(0, raw));
  return roundMoney(clamped);
}
