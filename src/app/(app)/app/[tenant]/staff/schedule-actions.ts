"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";

const scheduleDaySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  starts_at: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  ends_at: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
});

export type ScheduleActionState = { error: string | null };

export async function updateStaffSchedule(
  tenantSlug: string,
  staffId: string,
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const daysRaw = formData.get("days");
  let days: unknown;
  try {
    days = JSON.parse(typeof daysRaw === "string" ? daysRaw : "[]");
  } catch {
    return { error: "Los horarios no se pudieron leer, probá de nuevo" };
  }

  const parsed = z.array(scheduleDaySchema).safeParse(days);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();

  // Reemplaza el conjunto completo -- versionar horarios con valid_from/
  // valid_to (sección 3.3) queda para cuando haga falta cambiar un
  // horario a futuro sin perder el vigente; por ahora esta UI siempre
  // edita "el horario de hoy en adelante".
  const { error: deleteError } = await supabase
    .from("staff_schedules")
    .delete()
    .eq("staff_id", staffId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (parsed.data.length > 0) {
    const { error: insertError } = await supabase.from("staff_schedules").insert(
      parsed.data.map((day) => ({
        staff_id: staffId,
        weekday: day.weekday,
        starts_at: day.starts_at,
        ends_at: day.ends_at,
      })),
    );

    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}
