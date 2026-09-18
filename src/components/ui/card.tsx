import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift + shadow expansion on hover (sección "Interactive Hover Lift" del DESIGN.md). Default: true. */
  hoverLift?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverLift = true, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-card border border-border bg-surface p-xl shadow-card transition-[transform,box-shadow] duration-200 ease-out",
        hoverLift && "hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";
