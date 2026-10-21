export type PaymentKind = "deposit" | "balance" | "full" | "refund" | "adjustment";
export type PaymentMethod = "mercadopago" | "cash" | "transfer" | "card_posnet";

export type PaymentRecord = {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  status: "approved" | "pending" | "rejected" | "refunded";
  grossAmount: number;
  appliedAmount: number;
  feeAmount: number;
  surchargeAmount: number;
  netAmount: number;
  paidAt: Date;
  source: "public_checkout" | "admin" | "cash_register" | "migration";
  externalReference?: string | null;
  externalPaymentId?: string | null;
  tenantId?: string;
  appointmentId?: string;
};

export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Total a cobrar para que, luego de la tasa, quede exactamente `netAmount`. */
export function grossUp(netAmount: number, feeRate: number): number {
  if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error("Monto inválido");
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate >= 1) throw new Error("Tasa inválida");
  return Math.ceil((netAmount / (1 - feeRate)) * 100) / 100;
}

export function checkoutAmounts(input: {
  depositAmount: number;
  feeMode: "absorbed" | "passed_through";
  feeRate: number;
}) {
  const appliedAmount = roundMoney(Math.max(0, input.depositAmount));
  const grossAmount = input.feeMode === "passed_through" ? grossUp(appliedAmount, input.feeRate) : appliedAmount;
  const surchargeAmount = roundMoney(grossAmount - appliedAmount);
  return { appliedAmount, grossAmount, surchargeAmount };
}

export function paymentDocument(record: PaymentRecord) {
  return {
    id: record.id,
    kind: record.kind,
    method: record.method,
    status: record.status,
    // Compatibilidad temporal con lecturas existentes.
    amount: roundMoney(record.appliedAmount),
    grossAmount: roundMoney(record.grossAmount),
    appliedAmount: roundMoney(record.appliedAmount),
    feeAmount: roundMoney(record.feeAmount),
    surchargeAmount: roundMoney(record.surchargeAmount),
    netAmount: roundMoney(record.netAmount),
    paidAt: record.paidAt,
    createdAt: record.paidAt,
    source: record.source,
    externalReference: record.externalReference ?? null,
    externalPaymentId: record.externalPaymentId ?? null,
    tenantId: record.tenantId ?? null,
    appointmentId: record.appointmentId ?? null,
  };
}
