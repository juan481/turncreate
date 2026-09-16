-- Extiende las RPCs de la Fase 1 para soportar motivo de cancelación y
-- reprogramar (sección 5.3: "Reprogramar crea un turno nuevo con
-- rescheduled_from_id, traslada la seña y cancela el original").
--
-- Un CREATE OR REPLACE con una firma de parámetros distinta sobrecarga la
-- función en vez de reemplazarla -- hay que borrar la versión vieja a mano
-- para no dejar dos funciones con el mismo nombre coexistiendo.
drop function if exists transition_appointment(uuid, text);
drop function if exists create_staff_appointment(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb
);

create function transition_appointment(
  p_appointment_id uuid,
  p_to_status text,
  p_reason text default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_from_status text;
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
    raise exception 'Sin permiso para cambiar este turno';
  end if;

  v_from_status := v_appointment.status;

  if (v_from_status, p_to_status) not in (
    ('pending_payment', 'confirmed'),
    ('pending_payment', 'expired'),
    ('pending_payment', 'cancelled'),
    ('confirmed', 'completed'),
    ('confirmed', 'no_show'),
    ('confirmed', 'cancelled')
  ) then
    raise exception 'Transición % -> % no permitida', v_from_status, p_to_status;
  end if;

  update appointments
  set status = p_to_status,
      cancel_reason = case when p_to_status = 'cancelled' then p_reason else cancel_reason end
  where id = p_appointment_id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (p_appointment_id, v_from_status, p_to_status, auth.uid());

  if p_to_status in ('cancelled', 'expired', 'no_show') then
    delete from appointment_segments where appointment_id = p_appointment_id;
  end if;

  if p_to_status = 'no_show' then
    update clients set no_show_count = no_show_count + 1 where id = v_appointment.client_id;
  end if;

  return v_appointment;
end;
$$;

revoke execute on function transition_appointment(uuid, text, text) from public;
grant execute on function transition_appointment(uuid, text, text) to authenticated;

create function create_staff_appointment(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_client_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_items jsonb,
  p_segments jsonb,
  p_rescheduled_from_id uuid default null
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
    coalesce(v_original.deposit_required, 0), coalesce(v_original.deposit_paid, 0), p_rescheduled_from_id
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
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid
) from public;
grant execute on function create_staff_appointment(
  uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid
) to authenticated;
