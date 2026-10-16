import { describe, expect, it } from "vitest";
import { cancelSourceOf, publicCancelReason } from "./public-cancel-reason";

describe("publicCancelReason", () => {
  it("nunca muestra el texto libre de la dueña", () => {
    const reason = publicCancelReason({ cancelReason: "Es una clienta conflictiva, no darle más turnos" });
    expect(reason).toBe("El local canceló este turno.");
    expect(reason).not.toContain("conflictiva");
  });

  it("usa cancelSource cuando está", () => {
    expect(cancelSourceOf({ cancelSource: "client", cancelReason: "lo que sea" })).toBe("client");
    expect(cancelSourceOf({ cancelSource: "transfer_expired" })).toBe("transfer_expired");
    expect(publicCancelReason({ cancelSource: "transfer_expired" })).toMatch(/no llegó a tiempo/);
  });

  it("en turnos viejos reconoce los textos fijos del sistema", () => {
    expect(cancelSourceOf({ cancelReason: "Cancelado por la clienta" })).toBe("client");
    expect(cancelSourceOf({ cancelReason: "No se confirmó la transferencia de la seña a tiempo" })).toBe("transfer_expired");
    expect(cancelSourceOf({ cancelReason: "La transferencia de la seña no llegó" })).toBe("transfer_rejected");
    expect(cancelSourceOf({ cancelReason: "Reprogramado" })).toBe("rescheduled");
  });

  it("valores raros caen en 'cancelado por el local'", () => {
    expect(cancelSourceOf({ cancelSource: "hack", cancelReason: "toString" })).toBe("owner");
    expect(cancelSourceOf({})).toBe("owner");
  });
});
