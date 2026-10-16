import { byGender } from "@/lib/gender";
import { minutesOfDayInTz } from "@/lib/dates";

export type DayPart = "morning" | "afternoon" | "night";

/** Franja del día por hora local del LOCAL (0-23): 5-12 día, 12-20 tarde, 20-5 noche. */
export function dayPartForHour(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 20) return "afternoon";
  return "night";
}

/** Franja del día AHORA en `timezone` (la del local, nunca la del servidor/VPS en UTC). */
export function currentDayPart(timezone: string, now: Date = new Date()): DayPart {
  return dayPartForHour(Math.floor(minutesOfDayInTz(now, timezone) / 60));
}

export const DAY_PART_COPY: Record<DayPart, { hello: string; icon: string }> = {
  morning: { hello: "Buen día", icon: "light_mode" },
  afternoon: { hello: "Buenas tardes", icon: "wb_sunset" },
  night: { hello: "Buenas noches", icon: "dark_mode" },
};

/** "Ana María López" -> "Ana". Vacío si no hay nombre usable (ni un email). */
export function firstNameOf(fullName: unknown): string {
  if (typeof fullName !== "string") return "";
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.includes("@") ? "" : first;
}

export function greetingLines({ dayPart, firstName, gender, tenantName }: { dayPart: DayPart; firstName: string; gender: unknown; tenantName: string }) {
  const { hello, icon } = DAY_PART_COPY[dayPart];
  return {
    icon,
    title: firstName ? `${hello}, ${firstName}` : hello,
    subtitle: byGender(gender, {
      female: `Qué bueno verte, bienvenida de nuevo a ${tenantName}.`,
      male: `Qué bueno verte, bienvenido de nuevo a ${tenantName}.`,
      neutral: `Qué bueno verte por ${tenantName}.`,
    }),
  };
}
