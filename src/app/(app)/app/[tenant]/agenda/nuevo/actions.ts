"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { sendAppointmentConfirmation } from "@/server/email";
import {
  computeSegmentInstants,
  getServiceCombo,
  getStaffIdsForService,
  instantToMinutes,
  assignAnyStaffForSlot,
} from "@/server/availability";
import { computeTotalDuration } from "@/domain/availability";
import { createClientSchema } from "@/lib/schemas/client";

export type ConfirmAppointmentState = { error: string | null };

// Cliente nuevo cargado en el momento de agendar (sección 3.5: un turno
// manual no debería requerir salir del flujo a /clientes primero).
export async function createClientQuick(
  tenantSlug: string,
  data: { fullName: string; phoneE164: string; email: string },
): Promise<{ id: string } | { error: string }> {
  const parsed = createClientSchema.safeParse({
    fullName: data.fullName,
    phoneE164: data.phoneE164,
    email: data.email || "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { data: inserted, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: tenant.id,
      full_name: parsed.data.fullName,
      phone_e164: parsed.data.phoneE164,
      email: parsed.data.email || null,
    })
    .select("id")
    .single();

  if (error) {
    return {
      error: error.code === "23505" ? "Ya existe un cliente con ese teléfono" : error.message,
    };
  }

  return { id: inserted.id };
}

export async function confirmAppointment(
  tenantSlug: string,
  _prevState: ConfirmAppointmentState,
  formData: FormData,
): Promise<ConfirmAppointmentState> {
  const staffId = formData.get("staffId");
  const clientId = formData.get("clientId");
  const serviceId = formData.get("serviceId");
  const dateISO = formData.get("date");
  const startsAtISO = formData.get("startsAt");
  const rescheduleFrom = formData.get("rescheduleFrom");
  const keepDeposit = formData.get("keepDeposit");
  const depositAmountRaw = formData.get("depositAmount");
  const depositMethod = formData.get("depositMethod");
  const depositAmount =
    typeof depositAmountRaw === "string" && depositAmountRaw ? Number(depositAmountRaw) : 0;

  if (
    typeof staffId !== "string" ||
    typeof clientId !== "string" ||
    typeof serviceId !== "string" ||
    typeof dateISO !== "string" ||
    typeof startsAtISO !== "string"
  ) {
    return { error: "Faltan datos para confirmar el turno" };
  }

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);
  const combo = await getServiceCombo(supabase, [serviceId]);

  const startMinute = instantToMinutes(startsAtISO, tenant.timezone);

  let finalStaffId = staffId;
  if (staffId === "any") {
    const eligibleStaffIds = await getStaffIdsForService(supabase, {
      tenantId: tenant.id,
      serviceId,
    });
    if (eligibleStaffIds.length === 0) {
      return { error: "Ningún profesional activo tiene este servicio asignado." };
    }
    const assigned = await assignAnyStaffForSlot(supabase, {
      tenantId: tenant.id,
      dateISO,
      timezone: tenant.timezone,
      combo,
      startMinute,
      staffIds: eligibleStaffIds,
    });
    if (!assigned) {
      return { error: "No hay profesionales disponibles en este horario." };
    }
    finalStaffId = assigned;
  }

  const segments = computeSegmentInstants({ dateISO, startMinute, combo, timezone: tenant.timezone });

  const startsAt = new Date(startsAtISO);
  const totalDuration = computeTotalDuration(combo.phases, combo.bufferAfterMin);
  const endsAt = new Date(startsAt.getTime() + totalDuration * 60_000);

  const { data: created, error } = await supabase.rpc("create_staff_appointment", {
    p_tenant_id: tenant.id,
    p_staff_id: finalStaffId,
    p_client_id: clientId,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_items: [
      {
        service_id: serviceId,
        name: combo.items[0].name,
        price: combo.items[0].price,
        phases: combo.items[0].phases,
        buffer_min: combo.items[0].bufferAfterMin,
      },
    ],
    p_segments: segments.map((s) => ({
      starts_at: s.startsAt.toISOString(),
      ends_at: s.endsAt.toISOString(),
    })),
    p_rescheduled_from_id:
      typeof rescheduleFrom === "string" && rescheduleFrom ? rescheduleFrom : undefined,
    p_keep_deposit: keepDeposit !== "false",
  });

  if (error) {
    return { error: error.message };
  }

  // Send confirmation email (fire and forget — never block the redirect on it)
  void (async () => {
    try {
      const { data: appt } = await supabase
        .from("appointments")
        .select("starts_at, clients(full_name, email), appointment_items(name), tenants(name, address, whatsapp_number)")
        .eq("id", created.id)
        .maybeSingle();
      const clientRow = appt?.clients as { full_name: string; email?: string | null } | null;
      const clientEmail = clientRow?.email;
      if (appt && clientEmail) {
        const startsAtDate = new Date(appt.starts_at);
        const date = startsAtDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tenant.timezone });
        const time = startsAtDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tenant.timezone });
        const tenantData = appt.tenants as { name: string; address?: string | null; whatsapp_number?: string | null } | null;
        await sendAppointmentConfirmation(clientEmail, {
          clientName: clientRow.full_name,
          businessName: tenantData?.name ?? tenant.name,
          serviceName: (appt.appointment_items as { name: string }[])[0]?.name ?? "Turno",
          date,
          time,
          address: tenantData?.address ?? undefined,
          whatsapp: tenantData?.whatsapp_number ?? undefined,
        });
      }
    } catch (e) {
      console.error("[email] confirmation failed:", e);
    }
  })();

  if (depositAmount > 0 && (depositMethod === "cash" || depositMethod === "mercadopago")) {
    let cashSessionId: string | null = null;
    if (depositMethod === "cash") {
      const { data: session } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("tenant_id", tenant.id)
        .is("closed_at", null)
        .maybeSingle();
      cashSessionId = session?.id ?? null;
    }

    const { error: depositError } = await supabase.rpc("register_appointment_deposit", {
      p_appointment_id: created.id,
      p_amount: depositAmount,
      p_method: depositMethod,
      p_cash_session_id: cashSessionId ?? undefined,
    });

    if (depositError) {
      // El turno ya se creó -- no lo perdemos por un error al cobrar la
      // seña, solo avisamos para que se cobre después desde el detalle.
      redirect(
        `/app/${tenantSlug}/agenda/${created.id}?depositError=${encodeURIComponent(depositError.message)}`,
      );
    }
  }

  redirect(`/app/${tenantSlug}/agenda?date=${dateISO}`);
}
