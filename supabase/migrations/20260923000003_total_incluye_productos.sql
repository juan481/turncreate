-- Sección 5.5: "Turno: total (ítems + productos) − pagos registrados =
-- saldo". finalize_appointment agregaba sale_items pero nunca sumaba su
-- valor a appointments.total -- el balance quedaba calculado solo sobre
-- el precio del servicio, ignorando los productos vendidos en el mismo
-- cobro (se detectó probando el flujo completo: vender un shampoo de
-- $3000 junto con el servicio no dejaba rastro en el total del turno).
create or replace function finalize_appointment(
  p_appointment_id uuid,
  p_payments jsonb,
  p_sale_items jsonb default '[]'::jsonb,
  p_cash_session_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_payment jsonb;
  v_sale_item jsonb;
  v_payment_id uuid;
  v_commission_rule commission_rules;
  v_commission_amount numeric(12, 2);
  v_service_total numeric(12, 2);
  v_product_total numeric(12, 2) := 0;
  v_first_service_id uuid;
  v_first_category_id uuid;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if not found then
    raise exception 'Turno no encontrado';
  end if;

  if not (
    has_role(v_appointment.tenant_id, array['admin', 'receptionist'])
    or (
      has_role(v_appointment.tenant_id, array['professional'])
      and v_appointment.staff_id = my_staff_id(v_appointment.tenant_id)
    )
  ) then
    raise exception 'Sin permiso para cobrar este turno';
  end if;

  if v_appointment.status <> 'confirmed' then
    raise exception 'Solo se pueden finalizar turnos confirmados';
  end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    if (v_payment ->> 'method') = 'cash' and p_cash_session_id is null then
      raise exception 'Falta la caja abierta para registrar un pago en efectivo';
    end if;

    insert into payments (tenant_id, appointment_id, kind, method, amount, status, mp_payment_id, cash_session_id)
    values (
      v_appointment.tenant_id, p_appointment_id, 'balance',
      v_payment ->> 'method', (v_payment ->> 'amount')::numeric, 'approved',
      v_payment ->> 'mp_payment_id',
      case when (v_payment ->> 'method') = 'cash' then p_cash_session_id else null end
    )
    returning id into v_payment_id;

    if (v_payment ->> 'method') = 'cash' then
      insert into cash_movements (cash_session_id, type, amount, reason, payment_id)
      values (p_cash_session_id, 'in', (v_payment ->> 'amount')::numeric, 'Cobro de turno', v_payment_id);
    end if;
  end loop;

  for v_sale_item in select * from jsonb_array_elements(p_sale_items) loop
    insert into sale_items (appointment_id, product_id, qty, unit_price)
    values (
      p_appointment_id,
      (v_sale_item ->> 'product_id')::uuid,
      (v_sale_item ->> 'qty')::integer,
      (v_sale_item ->> 'unit_price')::numeric
    );

    insert into stock_movements (product_id, qty, reason, appointment_id)
    values (
      (v_sale_item ->> 'product_id')::uuid,
      -(v_sale_item ->> 'qty')::integer,
      'Venta en turno',
      p_appointment_id
    );

    v_product_total := v_product_total + (v_sale_item ->> 'qty')::integer * (v_sale_item ->> 'unit_price')::numeric;
  end loop;

  -- total = ítems + productos (sección 5.5). Se hace acá, antes de
  -- calcular comisiones y antes de que el trigger recalcule el balance,
  -- para que ambos vean el total ya completo.
  if v_product_total > 0 then
    update appointments set total = total + v_product_total where id = p_appointment_id
    returning * into v_appointment;
  end if;

  select coalesce(sum(price), 0) into v_service_total
  from appointment_items where appointment_id = p_appointment_id;

  select service_id into v_first_service_id
  from appointment_items where appointment_id = p_appointment_id limit 1;

  select category_id into v_first_category_id
  from services where id = v_first_service_id;

  select cr.* into v_commission_rule
  from commission_rules cr
  where cr.tenant_id = v_appointment.tenant_id
    and (
      cr.service_id = v_first_service_id
      or cr.category_id = v_first_category_id
      or cr.staff_id = v_appointment.staff_id
    )
  order by
    case
      when cr.service_id is not null then 1
      when cr.category_id is not null then 2
      when cr.staff_id is not null then 3
    end
  limit 1;

  if v_commission_rule.id is not null then
    v_commission_amount := case
      when v_commission_rule.type = 'percent' then v_service_total * (v_commission_rule.value / 100)
      else v_commission_rule.value
    end;

    insert into commission_entries (appointment_id, staff_id, base_amount, amount)
    values (p_appointment_id, v_appointment.staff_id, v_service_total, v_commission_amount);
  end if;

  update appointments set status = 'completed' where id = p_appointment_id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (p_appointment_id, 'confirmed', 'completed', auth.uid());

  return v_appointment;
end;
$$;

revoke execute on function finalize_appointment(uuid, jsonb, jsonb, uuid) from public;
grant execute on function finalize_appointment(uuid, jsonb, jsonb, uuid) to authenticated;
