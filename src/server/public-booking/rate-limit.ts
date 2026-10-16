import "server-only";
import { headers } from "next/headers";

/**
 * Límite best-effort por proceso (mismo criterio que analytics/rate-limit):
 * las acciones públicas de reserva bloquean horarios sin login, así que un
 * script podría reservar toda la agenda cada 10 minutos. No reemplaza un
 * captcha/WAF, pero corta el abuso trivial sin gastar lecturas de Firestore.
 */
const WINDOW_MS = 10 * 60_000;
const MAX_ENTRIES = 20_000;
const hits = new Map<string, number[]>();

async function clientIdentity() {
  const list = await headers();
  // nginx pisa X-Real-IP con la IP real; en X-Forwarded-For el cliente puede
  // inventar las primeras entradas, así que solo vale la última.
  const realIp = list.get("x-real-ip")?.trim();
  const forwarded = list.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  return realIp || forwarded?.at(-1) || "unknown";
}

export async function assertPublicBookingRate(tenantId: string, action: "hold" | "transfer", max: number) {
  // Solo se puede apagar contra el emulador (E2E), nunca en producción.
  if (process.env.PUBLIC_BOOKING_RATE_LIMIT === "off" && process.env.FIRESTORE_EMULATOR_HOST) return;
  const key = `${tenantId}:${action}:${await clientIdentity()}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((at) => at > now - WINDOW_MS);
  if (recent.length >= max) {
    throw new Error("Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_ENTRIES) {
    for (const [entry, times] of hits) {
      if (!times.some((at) => at > now - WINDOW_MS)) hits.delete(entry);
    }
  }
}
