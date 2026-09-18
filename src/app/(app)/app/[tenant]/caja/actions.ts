"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";

export type CajaActionState = { error: string | null };

export async function openCash(
  tenantSlug: string,
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const openingAmount = Number(formData.get("openingAmount") ?? 0);

  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const { error } = await supabase.rpc("open_cash_session", {
    p_tenant_id: tenant.id,
    p_opening_amount: openingAmount,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/caja`);
  return { error: null };
}

export async function closeCash(
  tenantSlug: string,
  sessionId: string,
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const countedAmount = Number(formData.get("countedAmount") ?? 0);
  const differenceReason = formData.get("differenceReason");

  const supabase = await createClient();

  const { error } = await supabase.rpc("close_cash_session", {
    p_session_id: sessionId,
    p_counted_amount: countedAmount,
    p_difference_reason: typeof differenceReason === "string" && differenceReason ? differenceReason : undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/caja`);
  return { error: null };
}

export async function addCashMovement(
  tenantSlug: string,
  sessionId: string,
  _prevState: CajaActionState,
  formData: FormData,
): Promise<CajaActionState> {
  const type = formData.get("type");
  const amount = Number(formData.get("amount") ?? 0);
  const reason = formData.get("reason");

  if (type !== "in" && type !== "out") {
    return { error: "Tipo de movimiento inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_cash_movement", {
    p_cash_session_id: sessionId,
    p_type: type,
    p_amount: amount,
    p_reason: typeof reason === "string" ? reason : "",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/caja`);
  return { error: null };
}

export type ChargeActionState = { error: string | null };

export async function chargeAppointment(
  tenantSlug: string,
  _prevState: ChargeActionState,
  formData: FormData,
): Promise<ChargeActionState> {
  const appointmentId = formData.get("appointmentId");
  const sessionId = formData.get("sessionId");
  const amount = Number(formData.get("amount") ?? 0);
  const method = formData.get("method");
  const productId = formData.get("productId");
  const productQty = Number(formData.get("productQty") ?? 0);
  const productPrice = Number(formData.get("productPrice") ?? 0);

  if (typeof appointmentId !== "string" || typeof method !== "string") {
    return { error: "Faltan datos para cobrar" };
  }

  const supabase = await createClient();

  const saleItems =
    typeof productId === "string" && productId && productQty > 0
      ? [{ product_id: productId, qty: productQty, unit_price: productPrice }]
      : [];

  const { error } = await supabase.rpc("finalize_appointment", {
    p_appointment_id: appointmentId,
    p_payments: [{ method, amount }],
    p_sale_items: saleItems,
    p_cash_session_id: typeof sessionId === "string" && sessionId ? sessionId : undefined,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${tenantSlug}/caja`);
  return { error: null };
}
