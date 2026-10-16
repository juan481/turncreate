import { describe, expect, it } from "vitest";
import { rescheduleBlockReason } from "./reschedule";

describe("rescheduleBlockReason", () => {
  it("deja mover confirmados y pendientes comunes", () => {
    expect(rescheduleBlockReason({ status: "confirmed" })).toBeNull();
    expect(rescheduleBlockReason({ status: "pending_payment" })).toBeNull();
    expect(rescheduleBlockReason({ status: "pending_payment", awaitingTransfer: false })).toBeNull();
  });

  it("no deja mover un turno que espera transferencia", () => {
    expect(rescheduleBlockReason({ status: "pending_payment", awaitingTransfer: true })).toMatch(/transferencia/);
  });

  it("no deja mover cancelados, vencidos, completados ni ausentes", () => {
    expect(rescheduleBlockReason({ status: "cancelled" })).toMatch(/cancelado/);
    expect(rescheduleBlockReason({ status: "expired" })).toMatch(/venció/);
    expect(rescheduleBlockReason({ status: "completed" })).not.toBeNull();
    expect(rescheduleBlockReason({ status: "no_show" })).not.toBeNull();
  });

  it("si el turno original no existe, avisa", () => {
    expect(rescheduleBlockReason(null)).toMatch(/no existe/);
    expect(rescheduleBlockReason(undefined)).toMatch(/no existe/);
  });
});
