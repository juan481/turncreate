"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Fila entera tocable (≥44px) con un switch a la derecha: el título es el
 * nombre accesible y la descripción queda asociada con aria-describedby.
 * Mismo dibujo de switch que el editor de horarios.
 */
export function SwitchRow({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-14 w-full min-w-0 items-center gap-3 rounded-inner bg-surface-container-low px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed",
        !disabled && "active:bg-surface-container",
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span id={titleId} className={cn("block font-label-lg text-label-lg", disabled ? "text-on-surface-variant" : "text-on-surface")}>
          {title}
        </span>
        {description && (
          <span id={descriptionId} className="block font-body-sm text-body-sm text-on-surface-variant">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-pill transition-colors duration-200",
          checked ? "bg-secondary" : "bg-surface-container-highest",
          disabled && "opacity-60",
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 size-6 rounded-full bg-surface shadow-sm transition-transform duration-200 motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
