import { WEEK_ORDER, WEEKDAY_LABELS } from "@/components/ui/hours-editor-model";

// Textos cortos de estado para las tiles del hub y los ejemplos en vivo.
// Puro: se usa desde server components y desde los formularios.

export function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;
}

/** "09:00" → "9", "09:30" → "9:30". */
function shortTime(value: string) {
  const [hours, minutes] = value.split(":");
  return minutes === "00" ? String(Number(hours)) : `${Number(hours)}:${minutes}`;
}

function joinDays(labels: string[]) {
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

/**
 * "Lun a Sáb 9 a 19" cuando todos los días abiertos tienen la misma franja
 * y son seguidos; "Lun, Mié y Vie 9 a 19" si no son seguidos; "5 días
 * abiertos" si cada día tiene su horario (o es partido).
 */
export function hoursSummary(hours: { weekday: number; opensAt: string; closesAt: string }[]) {
  if (hours.length === 0) return "Sin horarios cargados";
  const byDay = new Map<number, { opensAt: string; closesAt: string }[]>();
  for (const hour of hours) byDay.set(hour.weekday, [...(byDay.get(hour.weekday) ?? []), hour]);
  const openDays = WEEK_ORDER.filter((weekday) => byDay.has(weekday));
  const signatures = new Set(openDays.map((weekday) => byDay.get(weekday)!.map((block) => `${block.opensAt}-${block.closesAt}`).sort().join("|")));
  const daysLabel = `${openDays.length} día${openDays.length === 1 ? "" : "s"} abierto${openDays.length === 1 ? "" : "s"}`;
  if (signatures.size !== 1) return daysLabel;
  const blocks = byDay.get(openDays[0])!;
  if (blocks.length !== 1) return `${daysLabel}, horario partido`;
  const range = `${shortTime(blocks[0].opensAt)} a ${shortTime(blocks[0].closesAt)}`;
  if (openDays.length === 7) return `Todos los días ${range}`;
  const positions = openDays.map((weekday) => WEEK_ORDER.indexOf(weekday));
  const contiguous = positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
  const short = openDays.map((weekday) => WEEKDAY_LABELS[weekday].short);
  if (contiguous && openDays.length > 2) return `${short[0]} a ${short[short.length - 1]} ${range}`;
  return `${joinDays(short)} ${range}`;
}

export function depositSummary(settings: { depositType: "none" | "fixed" | "percent"; depositValue: number; depositMin: number }) {
  if (settings.depositType === "none") return null;
  if (settings.depositType === "percent") {
    return `Seña ${formatPercent(settings.depositValue)}${settings.depositMin > 0 ? ` (mín. ${formatMoney(settings.depositMin)})` : ""}`;
  }
  return `Seña ${formatMoney(Math.max(settings.depositValue, settings.depositMin))}`;
}
