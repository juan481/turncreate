import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant outline-none ring-2 ring-transparent transition-all duration-200 ease-out focus:bg-surface focus:ring-secondary focus:shadow-card",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
