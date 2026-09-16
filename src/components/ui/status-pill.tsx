import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  confirmed: {
    bg: "bg-status-confirmed-bg",
    text: "text-status-confirmed",
    dot: "bg-status-confirmed-dot",
  },
  pending: {
    bg: "bg-status-pending-bg",
    text: "text-status-pending",
    dot: "bg-status-pending-dot",
  },
  alert: {
    bg: "bg-status-alert-bg",
    text: "text-status-alert",
    dot: "bg-status-alert-dot",
  },
  draft: {
    bg: "bg-status-draft-bg",
    text: "text-status-draft",
    dot: "bg-status-draft-dot",
  },
} as const;

export type StatusPillStatus = keyof typeof STATUS_STYLES;

export function StatusPill({
  status,
  children,
  className,
}: {
  status: StatusPillStatus;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-pill px-2.5 font-label-sm text-label-sm",
        styles.bg,
        styles.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {children}
    </span>
  );
}
