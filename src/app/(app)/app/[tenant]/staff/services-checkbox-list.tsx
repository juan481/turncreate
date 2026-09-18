"use client";

import { useState } from "react";

export type ServiceOption = { id: string; name: string; categoryName: string | null };

export function ServicesCheckboxList({
  services,
  defaultSelected = [],
  name = "serviceIds",
}: {
  services: ServiceOption[];
  defaultSelected?: string[];
  name?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups = new Map<string, ServiceOption[]>();
  for (const service of services) {
    const key = service.categoryName ?? "Sin categoría";
    groups.set(key, [...(groups.get(key) ?? []), service]);
  }

  if (services.length === 0) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Todavía no cargaste servicios en el catálogo.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-inner bg-surface-container-low p-3">
      <p className="font-label-sm text-label-sm text-on-surface-variant">¿Qué servicios puede atender?</p>
      {[...groups.entries()].map(([category, items]) => (
        <div key={category} className="space-y-1.5">
          <p className="font-label-sm text-label-sm text-on-surface-variant">{category}</p>
          <div className="flex flex-wrap gap-2">
            {items.map((service) => {
              const checked = selected.has(service.id);
              return (
                <label
                  key={service.id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-pill border px-3 py-1.5 font-label-sm text-label-sm transition-colors ${
                    checked
                      ? "border-primary bg-primary text-on-primary"
                      : "border-border bg-surface-container-lowest text-on-surface hover:border-outline-variant"
                  }`}
                >
                  <input
                    type="checkbox"
                    name={name}
                    value={service.id}
                    checked={checked}
                    onChange={() => toggle(service.id)}
                    className="sr-only"
                  />
                  {service.name}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
