import crypto from "node:crypto";

export function validateMercadoPagoSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}) {
  if (!input.signature || !input.requestId || !input.dataId || !input.secret) return false;
  const parts = Object.fromEntries(
    input.signature.split(",").map((part) => part.split("=").map((item) => item.trim())),
  );
  const ts = parts.ts;
  const received = parts.v1;
  if (!ts || !received || !/^\d+$/.test(ts) || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const nowMs = input.nowMs ?? Date.now();
  const tolerance = (input.toleranceSeconds ?? 300) * 1000;
  if (Math.abs(nowMs - Number(ts) * 1000) > tolerance) return false;
  const canonical = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", input.secret).update(canonical).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}
