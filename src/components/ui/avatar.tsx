import { cn } from "@/lib/utils";

const PALETTE = ["#7069E8", "#22C55E", "#F59E0B", "#EF4444", "#0EA5E9", "#EC4899", "#8B5CF6", "#14B8A6"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[18px]",
  xl: "h-20 w-20 text-[26px]",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  ring = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  ring?: boolean;
  className?: string;
}) {
  const sizeClasses = SIZES[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatares de prueba servidos por pravatar.cc, no optimizables por next/image
      <img
        src={src}
        alt={name}
        className={cn(
          "shrink-0 rounded-full object-cover shadow-sm",
          ring && "ring-2 ring-surface-container-high",
          sizeClasses,
          className,
        )}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-label-md font-semibold text-white shadow-sm",
        ring && "ring-2 ring-surface-container-high",
        sizeClasses,
        className,
      )}
      style={{ backgroundColor: colorFor(name) }}
    >
      {initialsFor(name)}
    </span>
  );
}
