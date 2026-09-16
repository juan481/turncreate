import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant outline-none ring-2 ring-transparent transition-shadow focus:ring-secondary",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
