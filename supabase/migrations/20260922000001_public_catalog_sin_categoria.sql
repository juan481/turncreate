-- get_public_catalog (migración 20260919000001) sólo traía servicios con
-- category_id -- como services.category_id es nullable (on delete set
-- null) y el formulario de alta de servicios no pide categoría, un
-- servicio recién creado quedaba invisible en el turnero público aunque
-- el panel de staff lo mostraba normal. Se agrega un grupo "Servicios"
-- para los que no tienen categoría asignada.
create or replace function get_public_catalog(p_tenant_id uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_result json;
  v_uncategorized json;
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

  select coalesce(json_agg(row_to_json(s)), '[]'::json) into v_uncategorized
  from (
    select
      sv.id, sv.name, sv.description, sv.price,
      coalesce(
        (select sum(sp.minutes) from service_phases sp where sp.service_id = sv.id), 0
      ) + sv.buffer_after_min as duration
    from services sv
    where sv.tenant_id = p_tenant_id
      and sv.category_id is null
      and sv.active = true
      and sv.public = true
      and sv.archived_at is null
    order by sv.sort, sv.name
  ) s;

  if jsonb_array_length(v_uncategorized::jsonb) > 0 then
    v_result := (
      v_result::jsonb || jsonb_build_array(
        jsonb_build_object('id', null, 'name', 'Servicios', 'services', v_uncategorized)
      )
    )::json;
  end if;

  return v_result;
end;
$$;
grant execute on function get_public_catalog(uuid) to public;
