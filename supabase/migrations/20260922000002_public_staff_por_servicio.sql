-- get_public_staff (migración 20260919000001) trae TODO el staff activo
-- del tenant sin importar qué servicios dicta -- el paso 2 del turnero
-- ("¿con quién?") podía ofrecer un profesional que no hace el servicio
-- elegido en el paso 1. staff_services (sección 3.3) ya modela esto
-- desde la Fase 0; ningún flujo de reserva lo consultaba todavía.
create or replace function get_public_staff_for_service(p_tenant_id uuid, p_service_id uuid)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
  v_result json;
begin
  select coalesce(json_agg(row_to_json(s)), '[]'::json) into v_result
  from (
    select st.id, st.display_name as name
    from staff st
    join staff_services ss on ss.staff_id = st.id
    where st.tenant_id = p_tenant_id
      and st.active = true
      and st.archived_at is null
      and ss.service_id = p_service_id
    order by st.display_name
  ) s;
  return v_result;
end;
$$;
grant execute on function get_public_staff_for_service(uuid, uuid) to public;
