import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { publicAppUrl } from "@/server/mercadopago/config";
import { oauthRepository } from "@/server/mercadopago/connections";
import { exchangeAuthorizationCode } from "@/server/mercadopago/oauth";

// Todas las salidas redirigen a la URL pública (nunca a request.url, que
// detrás de nginx es localhost:3011) y a Configuración → Pagos, donde
// vive la conexión de Mercado Pago.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  if (!rawState) return NextResponse.redirect(publicAppUrl("/login", request));

  const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
  const stateRef = firebaseAdmin().db.collection("mpOAuthStates").doc(stateHash);
  const state = await stateRef.get();
  const data = state.data();
  if (!state.exists || !data) return NextResponse.redirect(publicAppUrl("/login", request));

  const pagos = (result: "connected" | "error" | "denied" | "expired") =>
    NextResponse.redirect(publicAppUrl(`/app/${encodeURIComponent(String(data.tenantSlug))}/configuracion?mp=${result}#mercadopago`, request));

  if (data.consumedAt || data.expiresAt.toMillis() < Date.now()) return pagos("expired");
  await stateRef.update({ consumedAt: FieldValue.serverTimestamp() });
  if (providerError) return pagos("denied");
  if (!code) return pagos("error");
  try {
    const response = await exchangeAuthorizationCode(code);
    await oauthRepository.save(String(data.tenantId), response);
    return pagos("connected");
  } catch {
    return pagos("error");
  }
}
