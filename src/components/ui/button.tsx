import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  // El estado disabled usa colores sólidos apagados en vez de opacity-50:
  // un botón negro semitransparente sobre fondos con su propia
  // transparencia (cards dentro de cards) podía volverse casi ilegible.
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-label-md text-label-md transition-all duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:active:scale-100 disabled:bg-surface-container-high disabled:text-on-surface-variant disabled:shadow-none disabled:border-transparent disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
  {
    variants: {
      variant: {
        primary:
          "rounded-pill bg-primary text-on-primary shadow-card hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-card-hover active:translate-y-0",
        secondary:
          "rounded-pill bg-surface text-on-surface border border-border hover:-translate-y-0.5 hover:bg-surface-muted hover:shadow-card active:translate-y-0",
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
