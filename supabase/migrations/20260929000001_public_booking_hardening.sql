-- Hardening de reservas públicas.
-- El navegador puede modificar cualquier JSON enviado a una función pública,
-- por lo que tenant, staff, servicios y precios deben resolverse aquí.

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
  v_item jsonb;
  v_service services;
  v_original appointments;
  v_items jsonb := '[]'::jsonb;
  v_item_count integer := 0;
begin
  if not exists (
    select 1 from tenants
    where id = p_tenant_id and status in ('active', 'trial')
  ) then
    raise exception 'Local no disponible';
  end if;

  if not exists (
    select 1 from staff
    where id = p_staff_id and tenant_id = p_tenant_id
      and active = true and archived_at is null
  ) then
    raise exception 'Profesional no válido';
  end if;

  if p_starts_at >= p_ends_at or p_segments is null
     or jsonb_typeof(p_segments) <> 'array'
     or jsonb_array_length(p_segments) = 0 then
    raise exception 'Horario inválido';
  end if;

  -- Reemplaza los datos del cliente por el catálogo canónico.
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Servicios inválidos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_service
    from services
    where id = (v_item ->> 'service_id')::uuid
      and tenant_id = p_tenant_id
      and active = true
      and public = true
      and archived_at is null;

    if not found then
      raise exception 'Servicio no disponible';
    end if;

    if not exists (
      select 1 from staff_services
      where staff_id = p_staff_id and service_id = v_service.id
    ) then
      raise exception 'El profesional no realiza uno de los servicios';
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'service_id', v_service.id,
      'name', v_service.name,
      'price', v_service.price,
      'buffer_min', v_service.buffer_after_min,
      'phases', coalesce((
        select jsonb_agg(jsonb_build_object('kind', sp.kind, 'minutes', sp.minutes)
                         order by sp.position)
        from service_phases sp where sp.service_id = v_service.id
      ), '[]'::jsonb)
    ));
    v_item_count := v_item_count + 1;
  end loop;

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    if (v_segment ->> 'starts_at')::timestamptz >= (v_segment ->> 'ends_at')::timestamptz
       or (v_segment ->> 'starts_at')::timestamptz < p_starts_at
       or (v_segment ->> 'ends_at')::timestamptz > p_ends_at then
      raise exception 'Segmento de horario inválido';
    end if;
  end loop;

  delete from holds where expires_at < now();

  if p_rescheduled_from_id is not null then
    select * into v_original from appointments
    where id = p_rescheduled_from_id and tenant_id = p_tenant_id;
    if not found or v_original.status not in ('pending_payment', 'confirmed') then
      raise exception 'El turno original no se puede reprogramar';
    end if;
  end if;

  insert into holds (tenant_id, staff_id, starts_at, ends_at, items, rescheduled_from_id)
  values (p_tenant_id, p_staff_id, p_starts_at, p_ends_at, v_items, p_rescheduled_from_id)
  returning * into v_hold;

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    insert into appointment_segments (tenant_id, hold_id, staff_id, period)
    values (
      p_tenant_id, v_hold.id, p_staff_id,
      tstzrange((v_segment ->> 'starts_at')::timestamptz,
                (v_segment ->> 'ends_at')::timestamptz, '[)')
    );
  end loop;

  return v_hold;
end;
$$;

revoke execute on function create_public_hold(uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid) from public;
grant execute on function create_public_hold(uuid, uuid, timestamptz, timestamptz, jsonb, jsonb, uuid) to anon, authenticated;

-- La confirmación usa los items canónicos guardados en el hold, nunca el
-- payload del cliente, por lo que el total ya no puede manipularse.
