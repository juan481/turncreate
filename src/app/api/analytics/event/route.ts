import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  acceptPublicAnalyticsEvent,
  analyticsHashSecret,
  dailyVisitorHash,
  isPublicAnalyticsEvent,
  recordDailyAnalyticsEvent,
  resolveAnalyticsTenant,
  visitorBucket,
} from "@/server/analytics";
import { todayISO } from "@/lib/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "tc_av";
const MAX_BODY_LENGTH = 1024;

function isSameSiteRequest(request: NextRequest): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

function clientNetworkHint(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function response(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: NextRequest) {
  if (!isSameSiteRequest(request)) return response({ error: "Origen no permitido" }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return response({ error: "Content-Type inválido" }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_LENGTH) return response({ error: "Payload demasiado grande" }, 413);
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_LENGTH) return response({ error: "Payload demasiado grande" }, 413);

  let body: { slug?: unknown; event?: unknown };
  try {
    body = JSON.parse(rawBody) as { slug?: unknown; event?: unknown };
  } catch {
    return response({ error: "JSON inválido" }, 400);
  }
  if (typeof body.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || !isPublicAnalyticsEvent(body.event)) {
    return response({ error: "Evento inválido" }, 400);
  }

  const [tenant, secret] = await Promise.all([resolveAnalyticsTenant(body.slug), Promise.resolve(analyticsHashSecret())]);
  if (!tenant) return response({ error: "Turnero inexistente" }, 404);
  if (!secret) return response({ error: "Analítica no configurada" }, 503);

  const existingToken = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorToken = existingToken && /^[A-Za-z0-9_-]{20,64}$/.test(existingToken)
    ? existingToken
    : randomBytes(18).toString("base64url");
  const dateISO = todayISO(tenant.timezone);
  const networkHint = clientNetworkHint(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 256) ?? "unknown";
  const rateIdentity = dailyVisitorHash({ secret, tenantId: tenant.id, dateISO, identifier: `${networkHint}\0${userAgent}` });

  if (!acceptPublicAnalyticsEvent({ tenantId: tenant.id, event: body.event, rateIdentity })) {
    const limited = response({ accepted: false, reason: "rate_limited" }, 202);
    if (!existingToken) limited.cookies.set(VISITOR_COOKIE, visitorToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
    return limited;
  }

  const visitorHash = dailyVisitorHash({
    secret,
    tenantId: tenant.id,
    dateISO,
    identifier: `${visitorToken}\0${networkHint}\0${userAgent}`,
  });
  await recordDailyAnalyticsEvent({
    tenantId: tenant.id,
    timezone: tenant.timezone,
    event: body.event,
    visitorBucket: visitorBucket(visitorHash),
    dateISO,
  });

  const accepted = response({ accepted: true }, 202);
  if (!existingToken) accepted.cookies.set(VISITOR_COOKIE, visitorToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 31_536_000, path: "/" });
  return accepted;
}
