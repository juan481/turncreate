import { cn } from "@/lib/utils";

/**
 * Gráficos en CSS puro (barras divs con % inline), sin librería -- mismo
 * enfoque que ya usaba Reportes y que Perladerm usa en Visitas/Caja: en
 * este tipo de panel alcanza y pesa cero JS extra. Dos formas: columnas
 * (tendencia mensual) y barras horizontales (rankings).
 */
export function VerticalBarChart({
  data,
  height = 140,
  formatValue,
}: {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((point, i) => {
        const isLast = i === data.length - 1;
        const heightPct = Math.max((point.value / max) * 100, 3);
        return (
          <div key={`${point.label}-${i}`} className="flex h-full flex-1 flex-col items-center gap-1.5">
            <span className="font-label-sm text-label-sm tabular-nums text-on-surface-variant">
              {point.value > 0 ? (formatValue ? formatValue(point.value) : String(point.value)) : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t-md transition-all duration-500",
                  isLast ? "bg-primary" : "bg-secondary-soft",
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="font-label-sm text-label-sm capitalize text-on-surface-variant">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalBarList({
  data,
  formatValue,
  onItemClick,
}: {
  data: { id?: string; label: string; value: number }[];
  formatValue?: (value: number) => string;
  onItemClick?: (id: string) => void;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-2.5">
      {data.map((row, i) => {
        const pct = (row.value / max) * 100;
        const body = (
          <>
            <div className="mb-1 flex items-center justify-between gap-2 font-label-sm text-label-sm">
              <span className="truncate text-on-surface-variant">{row.label}</span>
              <span className="shrink-0 tabular-nums text-on-surface">
                {formatValue ? formatValue(row.value) : row.value}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-container-low">
              <div className="h-1.5 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        if (onItemClick && row.id) {
          return (
            <button
              key={row.id ?? i}
              type="button"
              onClick={() => onItemClick(row.id!)}
              className="block w-full text-left"
            >
              {body}
            </button>
          );
        }
        return <div key={row.id ?? i}>{body}</div>;
      })}
    </div>
  );
}
