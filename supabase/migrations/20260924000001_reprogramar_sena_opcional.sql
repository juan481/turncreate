-- Reprogramar transfería la seña del turno original siempre, sin
-- preguntar. Agrega p_keep_deposit: si es false, el turno nuevo arranca
-- sin seña (deposit_required/deposit_paid en 0) -- para cuando el cliente
-- pide cambiar de día y el local decide no arrastrar lo ya pagado.
drop function if exists create_staff_appointment(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid
);

create function create_staff_appointment(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_client_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_items jsonb,
  p_segments jsonb,
  p_rescheduled_from_id uuid default null,
  p_keep_deposit boolean default true
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_total numeric(12, 2);
  v_item jsonb;
  v_segment jsonb;
  v_original appointments;
begin
  if not has_role(p_tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para crear turnos';
  end if;

  if p_rescheduled_from_id is not null then
    select * into v_original from appointments
    where id = p_rescheduled_from_id and tenant_id = p_tenant_id;
    if not found then
      raise exception 'Turno original no encontrado';
    end if;
    if v_original.status not in ('pending_payment', 'confirmed') then
      raise exception 'Solo se puede reprogramar un turno pendiente o confirmado';
    end if;
  end if;

  select coalesce(sum((i ->> 'price')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) i;

  insert into appointments (
    tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total,
    deposit_required, deposit_paid, rescheduled_from_id
  )
  values (
    p_tenant_id, p_client_id, p_staff_id, p_starts_at, p_ends_at, 'confirmed', 'staff', v_total,
    case when p_keep_deposit then coalesce(v_original.deposit_required, 0) else 0 end,
    case when p_keep_deposit then coalesce(v_original.deposit_paid, 0) else 0 end,
    p_rescheduled_from_id
  )
  returning * into v_appointment;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into appointment_items (appointment_id, service_id, name, price, phases, buffer_min)
    values (
      v_appointment.id,
      (v_item ->> 'service_id')::uuid,
      v_item ->> 'name',
      (v_item ->> 'price')::numeric,
      coalesce(v_item -> 'phases', '[]'::jsonb),
      coalesce((v_item ->> 'buffer_min')::integer, 0)
    );
  end loop;

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
    values (
      p_tenant_id,
      v_appointment.id,
      p_staff_id,
      tstzrange((v_segment ->> 'starts_at')::timestamptz, (v_segment ->> 'ends_at')::timestamptz, '[)')
    );
  end loop;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (v_appointment.id, null, 'confirmed', auth.uid());

  if p_rescheduled_from_id is not null then
    perform transition_appointment(p_rescheduled_from_id, 'cancelled', 'Reprogramado');
  end if;

  return v_appointment;
end;
$$;

revoke execute on function create_staff_appointment(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid, boolean
) from public;
grant execute on function create_staff_appointment(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid, boolean
) to authenticated;
