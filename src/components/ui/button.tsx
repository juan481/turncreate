import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-label-md text-label-md transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
  {
    variants: {
      variant: {
        primary:
          "rounded-pill bg-primary text-on-primary shadow-card hover:bg-primary-hover active:bg-primary-hover",
        secondary:
          "rounded-pill bg-surface text-on-surface border border-border hover:bg-surface-muted",
        ghost: "rounded-pill text-on-surface hover:bg-surface-muted",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-label-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
