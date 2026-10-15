import { createHmac } from "node:crypto";
import { UNIQUE_VISITOR_BUCKETS } from "./model";

export function dailyVisitorHash(input: {
  secret: string;
  tenantId: string;
  dateISO: string;
  identifier: string;
}): string {
  return createHmac("sha256", input.secret)
    .update("turncreate-analytics-v1\0")
    .update(input.tenantId)
    .update("\0")
    .update(input.dateISO)
    .update("\0")
    .update(input.identifier)
    .digest("hex");
}

export function visitorBucket(visitorHash: string): number {
  if (!/^[a-f0-9]{64}$/i.test(visitorHash)) throw new Error("Hash de visitante inválido");
  return Number.parseInt(visitorHash.slice(0, 8), 16) % UNIQUE_VISITOR_BUCKETS;
}

export function analyticsHashSecret(): string | null {
  return process.env.ANALYTICS_HASH_SECRET
    ?? process.env.CRON_SECRET
    ?? process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
    ?? null;
}
