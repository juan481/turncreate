import "server-only";

export function mercadoPagoEnv() {
  const appId = process.env.MP_APP_ID?.trim() || process.env.MERCADOPAGO_APP_ID?.trim();
  const clientSecret = process.env.MP_CLIENT_SECRET?.trim() || process.env.MERCADOPAGO_APP_SECRET?.trim();
  const redirectUri = process.env.MP_OAUTH_REDIRECT_URI?.trim();
  const webhookSecret = process.env.MP_WEBHOOK_SECRET?.trim();
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appUrl = configuredUrl?.replace(/\/$/, "");
  return { appId, clientSecret, redirectUri, webhookSecret, appUrl };
}

export function requireMercadoPagoOAuthEnv() {
  const env = mercadoPagoEnv();
  if (!env.appId || !env.clientSecret || !env.redirectUri) {
    throw new Error("Mercado Pago todavía no está configurado en TurnCreate");
  }
  return { ...env, appId: env.appId, clientSecret: env.clientSecret, redirectUri: env.redirectUri };
}

/**
 * URL absoluta pública para redirigir desde una API route. Detrás de nginx
 * `request.url` llega como http://localhost:3011/..., así que nunca se usa
 * como base: primero NEXT_PUBLIC_APP_URL, después los headers del proxy.
 */
export function publicAppUrl(path: string, request?: Request): URL {
  const configured = mercadoPagoEnv().appUrl;
  if (configured) return new URL(path, `${configured}/`);
  const forwardedHost = request?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return new URL(path, `${proto}://${forwardedHost}/`);
  }
  return new URL(path, request ? new URL(request.url).origin : "https://turn.justcreate.com.ar");
}

export function isPublicHttpsUrl(value?: string): value is string {
  return Boolean(value && /^https:\/\//i.test(value) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value));
}
