"use server";

import { createClient } from "@/server/supabase/server";
import { createAdminClient } from "@/server/supabase/admin";
import {
  getServiceCombo,
  getAvailableSlotsForStaff,
  assignAnyStaffForSlot,
  computeSegmentInstants,
  instantToMinutes
} from "@/server/availability";
import { unionAnyStaffSlots } from "@/domain/availability/slots";
import { sendAppointmentConfirmation } from "@/server/email";
import type {
  PublicCategory,
  PublicStaffMember,
  PublicTenant,
  PublicHold,
  PublicAppointment,
  ClientFormData,
} from "./types";

export async function getPublicTenant(slug: string): Promise<PublicTenant | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_tenant", { p_slug: slug });
  if (error) throw error;
  return data as unknown as PublicTenant | null;
}

export async function getPublicCatalog(tenantId: string): Promise<PublicCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_catalog", { p_tenant_id: tenantId });
  if (error) throw error;
  return data as unknown as PublicCategory[];
}

export async function getPublicStaff(tenantId: string): Promise<PublicStaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_staff", { p_tenant_id: tenantId });
  if (error) throw error;
  return data as unknown as PublicStaffMember[];
}

/**
 * Solo los profesionales que dictan `serviceId` (staff_services, sección
 * 3.3) -- sin esto, el paso 2 ("¿con quién?") podía ofrecer a alguien
 * que no hace el servicio elegido en el paso 1.
 */
export async function getPublicStaffForService(
  tenantId: string,
  serviceId: string,
): Promise<PublicStaffMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_staff_for_service", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
  });
  if (error) throw error;
  return data as unknown as PublicStaffMember[];
}

export async function getAvailableSlots(
  tenantId: string, 
  serviceId: string, 
  staffId: string | "any", 
  dateISO: string, 
  timezone: string,
  allStaffIds: string[]
) {
  // La disponibilidad necesita consultar horarios y segmentos internos, que
  // están protegidos por RLS. Esta acción solo devuelve slots calculados y no
  // expone filas; la RPC de creación vuelve a validar todo en la base.
  const supabase = createAdminClient();
  const combo = await getServiceCombo(supabase, [serviceId]);
  
  const ids = staffId === "any" ? allStaffIds : [staffId];
  
  const allStaffSlots = await Promise.all(ids.map(async sId => {
      const slots = await getAvailableSlotsForStaff(supabase, {
          tenantId,
          staffId: sId,
          dateISO,
          timezone,
          combo,
          slotIntervalMin: 15,
          minNoticeMin: 60,
      });
      return { 
        staffId: sId, 
        slots: slots.map(s => instantToMinutes(s.startsAt.toISOString(), timezone)),
        slotMap: Object.fromEntries(slots.map(s => [instantToMinutes(s.startsAt.toISOString(), timezone), s.startsAt.toISOString()]))
      };
  }));

  if (staffId !== "any") {
     return Object.values(allStaffSlots[0].slotMap).sort();
  } else {
     const unionMinutes = unionAnyStaffSlots(allStaffSlots);
     // Combine slot maps to convert minutes back to ISO string
     const masterMap = allStaffSlots.reduce((acc, curr) => ({ ...acc, ...curr.slotMap }), {} as Record<number, string>);
     return unionMinutes.map(m => masterMap[m]).sort();
  }
}

export async function createHold(
  tenantId: string,
  serviceId: string,
  staffId: string | "any",
  allStaffIds: string[],
  startsAtISO: string,
  dateISO: string,
  timezone: string,
  rescheduleFrom?: string,
): Promise<PublicHold> {
  const supabase = createAdminClient();
  const combo = await getServiceCombo(supabase, [serviceId]);

  const startMinute = instantToMinutes(startsAtISO, timezone);

  let finalStaffId = staffId;
  if (finalStaffId === "any") {
     const leastBusy = await assignAnyStaffForSlot(supabase, {
         tenantId,
         dateISO,
         timezone,
         combo,
         startMinute,
         staffIds: allStaffIds,
     });
     if (!leastBusy) throw new Error("No available staff for this slot");
     finalStaffId = leastBusy;
  }

  const segments = computeSegmentInstants({ dateISO, startMinute, combo, timezone });
  if (segments.length === 0) throw new Error("No segments computed");
  
  const endsAtISO = segments[segments.length - 1].endsAt.toISOString();

  const { data, error } = await supabase.rpc("create_public_hold", {
    p_tenant_id: tenantId,
    p_staff_id: finalStaffId,
    p_starts_at: startsAtISO,
    p_ends_at: endsAtISO,
    p_items: combo.items,
    p_segments: segments.map(s => ({ starts_at: s.startsAt.toISOString(), ends_at: s.endsAt.toISOString() })),
    p_rescheduled_from_id: rescheduleFrom || undefined,
  });

  if (error) throw error;
  return data as unknown as PublicHold;
}

export async function confirmHold(
  holdId: string,
  clientData: ClientFormData,
): Promise<PublicAppointment> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_public_hold", {
    p_hold_id: holdId,
    p_client_data: clientData,
  });

  if (error) throw error;

  const appt = data as unknown as PublicAppointment;

  // Confirmation email (fire and forget — never throw to client on failure)
  if (clientData.email && appt?.id) {
    void (async () => {
      try {
        const { data: full } = await supabase
          .from("appointments")
          .select("starts_at, appointment_items(name), tenants(name, address, whatsapp_number, timezone)")
          .eq("id", appt.id)
          .maybeSingle();
        if (!full) return;
        const tenantData = (full.tenants as unknown as { name: string; address?: string | null; whatsapp_number?: string | null; timezone: string } | null);
        const tz = tenantData?.timezone ?? "America/Argentina/Buenos_Aires";
        const startsAtDate = new Date(full.starts_at);
        await sendAppointmentConfirmation(clientData.email!, {
          clientName: clientData.full_name,
          businessName: tenantData?.name ?? "",
          serviceName: (full.appointment_items as { name: string }[])[0]?.name ?? "Turno",
          date: startsAtDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: tz }),
          time: startsAtDate.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: tz }),
          address: tenantData?.address ?? undefined,
          whatsapp: tenantData?.whatsapp_number ?? undefined,
        });
      } catch (e) {
        console.error("[email] public confirmation failed:", e);
      }
    })();
  }

  return appt;
}
