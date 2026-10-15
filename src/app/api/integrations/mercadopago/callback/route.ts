import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireMercadoPagoOAuthEnv } from "@/server/mercadopago/config";
import { oauthRepository } from "@/server/mercadopago/connections";
import { exchangeAuthorizationCode } from "@/server/mercadopago/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  if (providerError) return NextResponse.json({ error: "Mercado Pago no autorizÃ³ la conexiÃ³n" }, { status: 400 });
  if (!code || !rawState) return NextResponse.json({ error: "Solicitud OAuth invÃ¡lida" }, { status: 400 });
  const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
  const stateRef = firebaseAdmin().db.collection("mpOAuthStates").doc(stateHash);
  const state = await stateRef.get();
  const data = state.data();
  if (!state.exists || !data || data.consumedAt || data.expiresAt.toMillis() < Date.now()) {
    return NextResponse.json({ error: "La autorizaciÃ³n venciÃ³ o ya fue utilizada" }, { status: 400 });
  }
  await stateRef.update({ consumedAt: FieldValue.serverTimestamp() });
  const env = requireMercadoPagoOAuthEnv();
  try {
    void env;
    const response = await exchangeAuthorizationCode(code);
    await oauthRepository.save(String(data.tenantId), response);
    return NextResponse.redirect(new URL(`/app/${data.tenantSlug}/configuracion?mp=connected`, request.url));
  } catch {
    return NextResponse.redirect(new URL(`/app/${data.tenantSlug}/configuracion?mp=error`, request.url));
  }
}
