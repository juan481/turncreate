-- Sección 4.2: "Funciones security definer con search_path fijo:
-- has_role(tenant_id, roles[]) y my_staff_id(tenant_id)".

create or replace function has_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from tenant_members tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role = any (p_roles)
  );
$$;

create or replace function my_staff_id(p_tenant_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select s.id
  from staff s
  join tenant_members tm on tm.id = s.member_id
  where s.tenant_id = p_tenant_id
    and tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid();
$$;
