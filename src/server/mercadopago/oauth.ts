import "server-only";
import { requireMercadoPagoOAuthEnv } from "./config";

type OAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  live_mode?: boolean;
  public_key?: string;
};

async function oauthToken(body: URLSearchParams): Promise<OAuthTokenResponse> {
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Mercado Pago rechazó OAuth (${response.status})`);
  return response.json() as Promise<OAuthTokenResponse>;
}

export async function exchangeAuthorizationCode(code: string) {
  const env = requireMercadoPagoOAuthEnv();
  return oauthToken(new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.appId,
    client_secret: env.clientSecret,
    code,
    redirect_uri: env.redirectUri,
  }));
}

export async function refreshSellerToken(refreshToken: string) {
  const env = requireMercadoPagoOAuthEnv();
  return oauthToken(new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.appId,
    client_secret: env.clientSecret,
    refresh_token: refreshToken,
  }));
}
