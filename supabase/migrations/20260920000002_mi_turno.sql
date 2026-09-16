-- Add token to appointments for public portal access
alter table appointments add column token uuid default gen_random_uuid();
create index appointments_token_idx on appointments(token);

-- Create function to get appointment by token
create or replace function get_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'appointment', to_jsonb(a.*),
    'client', to_jsonb(c.*),
    'staff', to_jsonb(s.*),
    'tenant', to_jsonb(t.*),
    'items', (
      select coalesce(jsonb_agg(to_jsonb(ai.*)), '[]'::jsonb)
      from appointment_items ai
      where ai.appointment_id = a.id
    )
  ) into v_result
  from appointments a
  join clients c on a.client_id = c.id
  join staff s on a.staff_id = s.id
  join tenants t on a.tenant_id = t.id
  where a.token = p_token;

  return v_result;
end;
$$;

revoke execute on function get_appointment_by_token(uuid) from public;
grant execute on function get_appointment_by_token(uuid) to anon, authenticated;

-- Create function to cancel appointment by token
create or replace function cancel_appointment_by_token(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_from_status text;
begin
  select * into v_appointment from appointments where token = p_token;
  if not found then
    raise exception 'Turno no encontrado';
  end if;

  v_from_status := v_appointment.status;

  if v_from_status not in ('pending_payment', 'confirmed') then
    raise exception 'Solo se pueden cancelar turnos pendientes o confirmados';
  end if;

  update appointments
  set status = 'cancelled',
      cancel_reason = 'Cancelado por el cliente desde el portal'
  where id = v_appointment.id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (v_appointment.id, v_from_status, 'cancelled', null);

  delete from appointment_segments where appointment_id = v_appointment.id;

  return to_jsonb(v_appointment);
end;
$$;

revoke execute on function cancel_appointment_by_token(uuid) from public;
grant execute on function cancel_appointment_by_token(uuid) to anon, authenticated;
