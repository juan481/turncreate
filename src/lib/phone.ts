// Teléfonos argentinos como los escribe cualquiera ("11 2233-4455",
// "011 15 2233 4455", "+54 9 11 ...") -> E.164 para WhatsApp/links.
// Nadie tiene que saber qué es el "formato internacional".
export function normalizeArPhone(input: string): string | null {
  const raw = input.trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith("54") && digits.length >= 11 && digits.length <= 13) return `+${digits}`;

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
  if (digits.length === 10) return `+549${digits}`;
  return null;
}

export const PHONE_HINT = "Con código de área, ej: 11 2233 4455";
