import { normalizeArPhone, PHONE_HINT } from "@/lib/phone";

export type PublicClientInput = { full_name: string; phone_e164: string; email: string };
export type PublicClient = { fullName: string; phone: string; email: string };

/** Datos que carga la clienta en el turnero, validados y con el teléfono en E.164. */
export function cleanPublicClient(client: PublicClientInput): PublicClient {
  const fullName = client.full_name.trim().replace(/\s+/g, " ");
  const phone = normalizeArPhone(client.phone_e164);
  const email = client.email.trim().toLowerCase();
  if (fullName.length < 2) throw new Error("Completá tu nombre");
  if (!phone) throw new Error(`Revisá tu WhatsApp. ${PHONE_HINT}`);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("El email no es válido");
  return { fullName, phone, email };
}
