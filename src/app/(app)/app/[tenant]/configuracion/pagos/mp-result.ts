// Fuera del componente cliente a propósito: la página (server) llama a
// isMpResult, y una función exportada desde un módulo "use client" llega al
// servidor como referencia de cliente, no se puede ejecutar ahí.

/** Valores de ?mp= con los que vuelven /api/integrations/mercadopago/connect y /callback. */
export type MpResult = "connected" | "error" | "denied" | "expired" | "unavailable";

export function isMpResult(value: unknown): value is MpResult {
  return value === "connected" || value === "error" || value === "denied" || value === "expired" || value === "unavailable";
}
