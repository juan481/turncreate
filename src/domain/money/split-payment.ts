import { roundMoney, type PaymentKind, type PaymentMethod } from "./payment";

export type ChargeSplit = {
  method: PaymentMethod;
  grossAmount: number;
  appliedAmount: number;
  productAmount: number;
};

/** Divide un cobro entre uno o dos medios sin alterar el saldo del servicio. */
export function splitCharge(input: {
  serviceAmount: number;
  productAmount?: number;
  primaryMethod: PaymentMethod;
  secondaryMethod?: PaymentMethod | null;
  secondaryAmount?: number;
}): ChargeSplit[] {
  const serviceAmount = roundMoney(input.serviceAmount);
  const productAmount = roundMoney(input.productAmount ?? 0);
  if (!(serviceAmount > 0) || productAmount < 0) throw new Error("Monto inválido");
  const total = roundMoney(serviceAmount + productAmount);

  if (!input.secondaryMethod) {
    return [{ method: input.primaryMethod, grossAmount: total, appliedAmount: serviceAmount, productAmount }];
  }
  if (input.secondaryMethod === input.primaryMethod) throw new Error("Elegí dos medios de pago distintos");
  const secondaryGross = roundMoney(input.secondaryAmount ?? 0);
  if (!(secondaryGross > 0) || secondaryGross >= total) throw new Error("El segundo medio debe cubrir una parte del total");
  const primaryGross = roundMoney(total - secondaryGross);

  // Se imputa primero al servicio y después al producto. Así la suma de
  // appliedAmount siempre coincide exactamente con lo descontado del turno.
  const primaryApplied = Math.min(serviceAmount, primaryGross);
  const secondaryApplied = roundMoney(serviceAmount - primaryApplied);
  return [
    { method: input.primaryMethod, grossAmount: primaryGross, appliedAmount: primaryApplied, productAmount: roundMoney(primaryGross - primaryApplied) },
    { method: input.secondaryMethod, grossAmount: secondaryGross, appliedAmount: secondaryApplied, productAmount: roundMoney(secondaryGross - secondaryApplied) },
  ];
}

export function chargeKind(input: { total: number; currentBalance: number; appliedAmount: number }): PaymentKind {
  if (!(input.appliedAmount > 0)) return "adjustment";
  const alreadyPaid = roundMoney(Math.max(0, input.total - input.currentBalance));
  if (alreadyPaid > 0) return "balance";
  return input.appliedAmount >= input.currentBalance ? "full" : "deposit";
}
