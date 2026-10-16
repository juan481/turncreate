// Teléfonos argentinos como los escribe cualquiera ("11 2233-4455",
// "011 15 2233 4455", "+54 9 11 ...") -> E.164 para WhatsApp/links.
// Nadie tiene que saber qué es el "formato internacional".
//
// Todas las variantes de un mismo celular tienen que dar EXACTAMENTE el
// mismo resultado: es la clave de tenantClientPhones, y una diferencia
// ("+54 11..." sin el 9) duplica a la clienta.
function nationalToE164(national: string): string | null {
  let digits = national;
  // Prefijo de larga distancia nacional.
  if (digits.startsWith("0")) digits = digits.slice(1);
  // El "15" de celular va después del código de área (de 2 a 4 dígitos):
  // 11 15 2233 4455 -> 11 2233 4455.
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return digits.length === 10 ? `+549${digits}` : null;
}

export function normalizeArPhone(input: string): string | null {
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Ya viene con el 54 del país (con o sin "+"): se le saca el 9 de celular
  // si lo tiene y se normaliza igual que un número local. Ningún código de
  // área argentino empieza con 5, así que "54..." nunca es un número local.
  if (digits.startsWith("54") && digits.length >= 12) {
    const national = digits.slice(2);
    return nationalToE164(national.startsWith("9") ? national.slice(1) : national);
  }
  // Otro país: se respeta tal cual.
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;

  return nationalToE164(digits);
}

export const PHONE_HINT = "Con código de área, ej: 11 2233 4455";
