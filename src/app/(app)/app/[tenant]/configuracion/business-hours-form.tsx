"use client";

import { useActionState, useState } from "react";
import { updateBusinessHours, type ConfigActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { HoursEditor, type DayHours } from "@/components/ui/hours-editor";
import { daysToHours, hoursToDays, sameHours, weekError, type FlatHours } from "@/components/ui/hours-editor-model";
import { useToast } from "@/components/ui/toast";

const initialState: ConfigActionState = { error: null };

export function BusinessHoursForm({
  tenantSlug,
  initialHours,
}: {
  tenantSlug: string;
  initialHours: { weekday: number; opens_at: string; closes_at: string }[];
}) {
  const toast = useToast();
  const [days, setDays] = useState<DayHours[]>(() => hoursToDays(initialHours));
  const [saved, setSaved] = useState<FlatHours[]>(() => daysToHours(hoursToDays(initialHours)));

  const payload = daysToHours(days);
  const error = weekError(days);
  const dirty = !sameHours(payload, saved);

  const [state, formAction, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateBusinessHours(tenantSlug, prev, formData);
    if (result.success) {
      setSaved(JSON.parse(String(formData.get("hours") ?? "[]")) as FlatHours[]);
      toast.show("Horarios guardados");
    }
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-md">
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />
      <HoursEditor value={days} onChange={setDays} />
      {/* Los errores de cada día ya se ven en su tarjeta; acá solo el de "todo cerrado". */}
      {error && !days.some((day) => day.active) && (
        <p role="alert" className="font-body-sm text-body-sm text-status-alert">{error}</p>
      )}
      {state.error && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={pending || Boolean(error) || !dirty}>
        {pending ? "Guardando…" : "Guardar horarios"}
      </Button>
    </form>
  );
}
