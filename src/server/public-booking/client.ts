import { normalizeArPhone, PHONE_HINT } from "@/lib/phone";

export type PublicClientInput = { full_name: string; phone_e164: string; email: string };
export type PublicClient = { fullName: string; phone: string; email: string };

// Llega de una server action pública: cualquier cosa puede venir en el body.
function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Datos que carga la clienta en el turnero, validados y con el teléfono en E.164. */
export function cleanPublicClient(client: PublicClientInput): PublicClient {
  const input = (client ?? {}) as Partial<Record<keyof PublicClientInput, unknown>>;
  const fullName = text(input.full_name, 120).trim().replace(/\s+/g, " ");
  const phone = normalizeArPhone(text(input.phone_e164, 40));
  const email = text(input.email, 200).trim().toLowerCase();
  if (fullName.length < 2) throw new Error("Completá tu nombre");
  if (!phone) throw new Error(`Revisá tu WhatsApp. ${PHONE_HINT}`);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("El email no es válido");
  return { fullName, phone, email };
}

/** Clave estable de un WhatsApp dentro de un local (misma que tenantClientPhones). */
export function tenantPhoneKey(tenantId: string, phoneE164: string): string {
  return `${tenantId}_${phoneE164.replace(/\D/g, "")}`;
}
