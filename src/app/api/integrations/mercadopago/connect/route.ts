import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { publicAppUrl, requireMercadoPagoOAuthEnv } from "@/server/mercadopago/config";

export async function GET(request: Request) {
  const tenantSlug = new URL(request.url).searchParams.get("tenant") ?? "";
  const pagosPath = `/app/${tenantSlug}/configuracion`;
  const user = await getCurrentFirebaseUser();
  if (!user) return NextResponse.redirect(publicAppUrl(`/login?next=${encodeURIComponent(pagosPath)}`, request));
  let tenantId: string;
  try {
    tenantId = (await requireTenantAccess(user.uid, tenantSlug)).tenant.id;
  } catch {
    return NextResponse.redirect(publicAppUrl("/login", request));
  }
  let env: ReturnType<typeof requireMercadoPagoOAuthEnv>;
  try {
    env = requireMercadoPagoOAuthEnv();
  } catch {
    return NextResponse.redirect(publicAppUrl(`${pagosPath}?mp=unavailable#mercadopago`, request));
  }
  const rawState = crypto.randomBytes(32).toString("base64url");
  const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
  await firebaseAdmin().db.collection("mpOAuthStates").doc(stateHash).create({
    tenantId,
    tenantSlug,
    uid: user.uid,
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60_000),
    consumedAt: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  const authorizationUrl = new URL("https://auth.mercadopago.com/authorization");
  authorizationUrl.searchParams.set("client_id", env.appId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("platform_id", "mp");
  authorizationUrl.searchParams.set("redirect_uri", env.redirectUri);
  authorizationUrl.searchParams.set("state", rawState);
  return NextResponse.redirect(authorizationUrl);
}
