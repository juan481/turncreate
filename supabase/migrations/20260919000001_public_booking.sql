-- Migration for Public Booking
create table holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  staff_id uuid not null references staff (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  items jsonb not null,
  rescheduled_from_id uuid references appointments (id),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now()
);

alter table holds enable row level security;
-- No default policies for holds, it's modified entirely by security definer RPCs.

alter table appointment_segments add column hold_id uuid references holds (id) on delete cascade;
alter table appointment_segments alter column appointment_id drop not null;

-- constraint to ensure one of hold_id or appointment_id is not null
alter table appointment_segments add constraint appointment_segments_owner_check check (
  (appointment_id is not null and hold_id is null) or 
  (appointment_id is null and hold_id is not null)
);

create or replace function get_public_tenant(p_slug text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_tenant record;
begin
  select id, slug, name, logo_url, timezone from tenants where slug = p_slug into v_tenant;
  if not found then
    return null;
  end if;
  return row_to_json(v_tenant);
end;
$$;
grant execute on function get_public_tenant(text) to public;

-- La duración no es una columna de `services` -- se suma desde
-- service_phases (sección 3.4: "Duración del servicio = suma de fases"),
-- igual que hace src/domain/availability/segments.ts del lado del cliente.
create or replace function get_public_catalog(p_tenant_id uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(c)), '[]'::json) into v_result
  from (
    select id, name,
      (
        select coalesce(json_agg(row_to_json(s)), '[]'::json)
        from (
          select
            sv.id, sv.name, sv.description, sv.price,
            coalesce(
              (select sum(sp.minutes) from service_phases sp where sp.service_id = sv.id), 0
            ) + sv.buffer_after_min as duration
          from services sv
          where sv.category_id = service_categories.id
            and sv.active = true
            and sv.public = true
            and sv.archived_at is null
          order by sv.sort, sv.name
        ) s
      ) as services
    from service_categories
    where tenant_id = p_tenant_id
    order by sort, name
  ) c;
  return v_result;
end;
$$;
grant execute on function get_public_catalog(uuid) to public;

create or replace function get_public_staff(p_tenant_id uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(s)), '[]'::json) into v_result
  from (
    select id, display_name as name
    from staff
    where tenant_id = p_tenant_id and active = true and archived_at is null
    order by display_name
  ) s;
  return v_result;
end;
$$;
grant execute on function get_public_staff(uuid) to public;

create or replace function create_public_hold(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_items jsonb,
  p_segments jsonb,
  p_rescheduled_from_id uuid default null
)
returns holds
language plpgsql security definer
set search_path = public
as $$
declare
  v_hold holds;
  v_segment jsonb;
  v_original appointments;
begin
  -- Delete expired holds to free up constraints
  delete from holds where expires_at < now();

  if p_rescheduled_from_id is not null then
    select * into v_original from appointments
    where id = p_rescheduled_from_id and tenant_id = p_tenant_id;
    if not found or v_original.status not in ('pending_payment', 'confirmed') then
      raise exception 'El turno original no se puede reprogramar';
    end if;
  end if;

  insert into holds (tenant_id, staff_id, starts_at, ends_at, items, rescheduled_from_id)
  values (p_tenant_id, p_staff_id, p_starts_at, p_ends_at, p_items, p_rescheduled_from_id)
  returning * into v_hold;

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    insert into appointment_segments (tenant_id, hold_id, staff_id, period)
    values (
      p_tenant_id,
      v_hold.id,
      p_staff_id,
      tstzrange((v_segment ->> 'starts_at')::timestamptz, (v_segment ->> 'ends_at')::timestamptz, '[)')
    );
  end loop;

  return v_hold;
end;
$$;
grant execute on function create_public_hold(uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid) to public;

create or replace function confirm_public_hold(
  p_hold_id uuid,
  p_client_data jsonb
)
returns appointments
language plpgsql security definer
set search_path = public
as $$
declare
  v_hold holds;
  v_client_id uuid;
  v_appointment appointments;
  v_total numeric(12, 2);
  v_item jsonb;
  v_original_status text;
begin
  select * into v_hold from holds where id = p_hold_id;
  if not found then
    raise exception 'Hold not found';
  end if;

  if v_hold.expires_at < now() then
    delete from holds where id = p_hold_id;
    raise exception 'Hold expired';
  end if;

  -- unique(tenant_id, phone_e164) es la clave natural del cliente
  -- (sección 3.5), no el email -- el turnero pide el teléfono siempre,
  -- el email es opcional.
  select id into v_client_id from clients
  where tenant_id = v_hold.tenant_id and phone_e164 = p_client_data ->> 'phone_e164'
  limit 1;

  if not found then
    insert into clients (tenant_id, full_name, phone_e164, email)
    values (
      v_hold.tenant_id,
      p_client_data ->> 'full_name',
      p_client_data ->> 'phone_e164',
      nullif(p_client_data ->> 'email', '')
    )
    returning id into v_client_id;
  else
    update clients set
      full_name = coalesce(p_client_data ->> 'full_name', full_name),
      email = coalesce(nullif(p_client_data ->> 'email', ''), email)
    where id = v_client_id;
  end if;

  select coalesce(sum((i ->> 'price')::numeric), 0) into v_total
  from jsonb_array_elements(v_hold.items) i;

  insert into appointments (
    tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, rescheduled_from_id
  )
  values (
    v_hold.tenant_id, v_client_id, v_hold.staff_id, v_hold.starts_at, v_hold.ends_at,
    'confirmed', 'public', v_total, v_hold.rescheduled_from_id
  )
  returning * into v_appointment;

  for v_item in select * from jsonb_array_elements(v_hold.items) loop
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

  update appointment_segments set hold_id = null, appointment_id = v_appointment.id where hold_id = p_hold_id;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (v_appointment.id, null, 'confirmed', null);

  delete from holds where id = p_hold_id;

  -- No se puede llamar a transition_appointment: exige has_role() de
  -- staff, y acá el actor es el cliente anónimo del turnero público. Se
  -- repite el mínimo necesario (mismo patrón que
  -- cancel_appointment_by_token en la migración de "Mi turno").
  if v_hold.rescheduled_from_id is not null then
    select status into v_original_status from appointments where id = v_hold.rescheduled_from_id;

    update appointments
    set status = 'cancelled', cancel_reason = 'Reprogramado por el cliente'
    where id = v_hold.rescheduled_from_id;

    insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
    values (v_hold.rescheduled_from_id, v_original_status, 'cancelled', null);

    delete from appointment_segments where appointment_id = v_hold.rescheduled_from_id;
  end if;

  return v_appointment;
end;
$$;
grant execute on function confirm_public_hold(uuid, jsonb) to public;
