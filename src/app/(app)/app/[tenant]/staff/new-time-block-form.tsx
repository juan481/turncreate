"use client";

import { useActionState } from "react";
import { createTimeBlock, type TimeBlockActionState } from "./time-block-actions";
import { Button } from "@/components/ui/button";

const initialState: TimeBlockActionState = { error: null };

const KIND_LABEL: Record<string, string> = {
  vacation: "Vacaciones",
  sick_leave: "Licencia médica",
  break: "Descanso",
  other: "Otro",
};

export function NewTimeBlockForm({
  tenantSlug,
  staff,
}: {
  tenantSlug: string;
  staff: { id: string; display_name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createTimeBlock.bind(null, tenantSlug),
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Quién</label>
        <select
          name="staffId"
          className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
        >
          <option value="">Todo el local</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Desde</label>
        <input
          type="datetime-local"
          name="startsAt"
          required
          className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
        />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Hasta</label>
        <input
          type="datetime-local"
          name="endsAt"
          required
          className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
        />
      </div>
      <div className="space-y-1.5">
        <label className="font-label-md text-label-md text-on-surface-variant">Motivo</label>
        <select
          name="kind"
          className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
        >
          {Object.entries(KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Bloqueando…" : "Bloquear"}
      </Button>
      {state.error && (
        <p className="sm:col-span-5 font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}
