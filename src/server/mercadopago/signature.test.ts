import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateMercadoPagoSignature } from "./signature";

describe("validateMercadoPagoSignature", () => {
  it("valida la plantilla oficial y rechaza firmas alteradas", () => {
    const secret = "secret";
    const ts = 1_700_000_000;
    const canonical = `id:123;request-id:req-1;ts:${ts};`;
    const hash = crypto.createHmac("sha256", secret).update(canonical).digest("hex");
    const base = { requestId: "req-1", dataId: "123", secret, nowMs: ts * 1000 };
    expect(validateMercadoPagoSignature({ ...base, signature: `ts=${ts},v1=${hash}` })).toBe(true);
    expect(validateMercadoPagoSignature({ ...base, signature: `ts=${ts},v1=${"0".repeat(64)}` })).toBe(false);
  });
});
