-- Sección 7.1 (Onboarding): crea el local completo en una transacción.
-- El wizard hacía inserts directos desde el cliente, lo cual no podía
-- funcionar: `tenants` no tiene policy de insert (el alta es por RPC a
-- propósito, sección 3.2 / ADR 0001) y usaba role='owner', que no existe
-- en el CHECK de tenant_members (admin/receptionist/professional) --
-- el dueño del local es simplemente un 'admin' con acceso total.
create or replace function onboard_tenant(
  p_name text,
  p_slug text,
  p_business_type_id uuid,
  p_business_hours jsonb
)
returns tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant tenants;
  v_hour jsonb;
  v_template record;
  v_service_id uuid;
  v_phase jsonb;
begin
  if not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'No autenticado';
  end if;

  insert into tenants (name, slug, business_type_id, status)
  values (p_name, p_slug, p_business_type_id, 'trial')
  returning * into v_tenant;

  insert into tenant_settings (tenant_id) values (v_tenant.id);

  insert into tenant_members (tenant_id, user_id, role, status)
  values (v_tenant.id, auth.uid(), 'admin', 'active');

  for v_hour in select * from jsonb_array_elements(p_business_hours) loop
    insert into business_hours (tenant_id, weekday, opens_at, closes_at)
    values (
      v_tenant.id,
      (v_hour ->> 'weekday')::smallint,
      (v_hour ->> 'opens_at')::time,
      (v_hour ->> 'closes_at')::time
    );
  end loop;

  -- Copia el catálogo sugerido del rubro (sección 7.1: "se copian las
  -- service_templates del rubro").
  for v_template in
    select * from service_templates where business_type_id = p_business_type_id
  loop
    insert into services (tenant_id, name, price, buffer_after_min, active, public)
    values (v_tenant.id, v_template.name, v_template.price_suggested, v_template.buffer_min, true, true)
    returning id into v_service_id;

    for v_phase in select * from jsonb_array_elements(v_template.phases) loop
      insert into service_phases (service_id, position, kind, minutes)
      values (
        v_service_id,
        (v_phase ->> 'position')::integer,
        v_phase ->> 'kind',
        (v_phase ->> 'minutes')::integer
      );
    end loop;
  end loop;

  return v_tenant;
end;
$$;

revoke execute on function onboard_tenant(text, text, uuid, jsonb) from public;
grant execute on function onboard_tenant(text, text, uuid, jsonb) to authenticated;
