import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        // text-body-lg (16px), no body-md (14px): <16px en un <input>
        // dispara el zoom automático de Safari/iOS al enfocar el campo.
        "h-11 w-full rounded-pill border border-outline-variant/70 bg-surface px-4 font-body-lg text-body-lg text-on-surface placeholder:text-on-surface-variant/70 outline-none ring-2 ring-transparent transition-all duration-200 ease-out hover:border-secondary/45 focus:border-secondary focus:bg-surface focus:ring-secondary/25 focus:shadow-card",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
