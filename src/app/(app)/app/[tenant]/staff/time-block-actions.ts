"use server";

import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { createTimeBlockSchema } from "@/lib/schemas/time-block";

export type TimeBlockActionState = { error: string | null };

export async function createTimeBlock(
  tenantSlug: string,
  _prevState: TimeBlockActionState,
  formData: FormData,
): Promise<TimeBlockActionState> {
  const parsed = createTimeBlockSchema.safeParse({
    staffId: formData.get("staffId") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    kind: formData.get("kind"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  // "2026-10-01T14:00" del <input type="datetime-local"> es hora local
  // del tenant, no del navegador ni del servidor -- se interpreta con
  // TZDate en la timezone real del local antes de guardar en UTC.
  const startsAt = new TZDate(parsed.data.startsAt, tenant.timezone);
  const endsAt = new TZDate(parsed.data.endsAt, tenant.timezone);

  const { error } = await supabase.from("time_blocks").insert({
    tenant_id: tenant.id,
    staff_id: parsed.data.staffId || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    kind: parsed.data.kind,
    reason: parsed.data.reason || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/staff`);
  return { error: null };
}
