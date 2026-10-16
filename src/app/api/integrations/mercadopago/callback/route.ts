import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";
import { publicAppUrl } from "@/server/mercadopago/config";
import { oauthRepository } from "@/server/mercadopago/connections";
import { exchangeAuthorizationCode } from "@/server/mercadopago/oauth";

type OAuthState = { tenantId: string; tenantSlug: string; uid: string };

// Todas las salidas redirigen a la URL pública (nunca a request.url, que
// detrás de nginx es localhost:3011) y a Configuración → Pagos y señas,
// donde vive la conexión de Mercado Pago.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const toLogin = () => NextResponse.redirect(publicAppUrl("/login"));
  if (!rawState) return toLogin();

  const stateHash = crypto.createHash("sha256").update(rawState).digest("hex");
  const stateRef = firebaseAdmin().db.collection("mpOAuthStates").doc(stateHash);
  // El state es de un solo uso: se consume en una transacción para que dos
  // callbacks simultáneos con el mismo state no puedan pasar los dos.
  const claimed = await firebaseAdmin().db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    const data = snapshot.data();
    if (!snapshot.exists || !data) return { status: "missing" as const };
    const state: OAuthState = { tenantId: String(data.tenantId), tenantSlug: String(data.tenantSlug), uid: String(data.uid) };
    if (data.consumedAt || data.expiresAt.toMillis() < Date.now()) return { status: "expired" as const, state };
    transaction.update(stateRef, { consumedAt: FieldValue.serverTimestamp() });
    return { status: "ok" as const, state };
  });
  if (claimed.status === "missing") return toLogin();

  const { state } = claimed;
  const pagos = (result: "connected" | "error" | "denied" | "expired") =>
    NextResponse.redirect(publicAppUrl(`/app/${encodeURIComponent(state.tenantSlug)}/configuracion/pagos?mp=${result}`));

  // Quien vuelve de Mercado Pago tiene que ser quien inició la conexión y
  // seguir teniendo acceso al local. Si no, un link de autorización con el
  // state de otra persona vincularía la cuenta de MP de la víctima al local
  // del atacante.
  const user = await getCurrentFirebaseUser();
  if (!user || user.uid !== state.uid) return toLogin();
  try {
    await requireTenantAccess(user.uid, state.tenantSlug);
  } catch {
    return toLogin();
  }

  if (claimed.status === "expired") return pagos("expired");
  if (providerError) return pagos("denied");
  if (!code) return pagos("error");
  try {
    const response = await exchangeAuthorizationCode(code);
    await oauthRepository.save(state.tenantId, response);
    return pagos("connected");
  } catch {
    return pagos("error");
  }
}
