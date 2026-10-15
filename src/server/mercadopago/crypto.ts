import "server-only";
import crypto from "node:crypto";

type Envelope = { v: 1; iv: string; tag: string; data: string };

function key() {
  const raw = process.env.MP_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("Falta MP_TOKEN_ENCRYPTION_KEY");
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const envelope: Envelope = {
    v: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    data: data.toString("base64url"),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

export function decryptSecret(value: string): string {
  const envelope = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Envelope;
  if (envelope.v !== 1) throw new Error("Versión de cifrado no soportada");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
