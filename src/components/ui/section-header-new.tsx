"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

export function SectionHeaderNew({
  title,
  subtitle,
  newLabel,
  newIcon,
  children,
}: {
  title: string;
  subtitle?: string;
  newLabel: string;
  newIcon: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{title}</h1>
          {subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>}
        </div>
        {!open && (
          <Button size="default" onClick={() => setOpen(true)}>
            <Icon name="add" className="text-[18px]" />
            {newLabel}
          </Button>
        )}
      </div>

      {open && (
        <Card hoverLift={false} className="animate-fade-up p-lg">
          <div className="mb-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-soft text-secondary">
                <Icon name={newIcon} className="text-[18px]" />
              </span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{newLabel}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
              aria-label="Cerrar"
            >
              <Icon name="close" className="text-[16px]" />
            </button>
          </div>
          {children}
        </Card>
      )}
    </div>
  );
}
