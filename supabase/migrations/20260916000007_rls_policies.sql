-- Sección 4: RLS en toda tabla, policies separadas por operación.
-- El rol anónimo no lee ninguna de estas tablas directamente (usa las
-- funciones RPC públicas que se agregan en la Fase 2 del plan).

-- Catálogos de plataforma: lectura pública (precios, rubros, feriados),
-- sin insert/update/delete desde el cliente (los gestiona la consola con
-- service role).
alter table plans enable row level security;
create policy plans_select on plans for select using (true);

alter table business_types enable row level security;
create policy business_types_select on business_types for select using (true);

alter table service_templates enable row level security;
create policy service_templates_select on service_templates for select using (true);

alter table holidays enable row level security;
create policy holidays_select on holidays for select using (true);

-- Cada usuario solo ve si él mismo es platform_admin (no la lista completa).
alter table platform_admins enable row level security;
create policy platform_admins_select on platform_admins
  for select using (user_id = auth.uid());

-- Sin policies: audit_logs y webhook_events solo se leen con service role.
alter table audit_logs enable row level security;
alter table webhook_events enable row level security;

-- profiles: cada usuario ve y edita el suyo.
alter table profiles enable row level security;
create policy profiles_select on profiles
  for select using (user_id = auth.uid());
create policy profiles_update on profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tenants: visible para sus miembros activos. El alta se hace por función
-- RPC en la Fase 4 (onboarding), no por insert directo del cliente.
alter table tenants enable row level security;
create policy tenants_select on tenants
  for select using (has_role(id, array['admin', 'receptionist', 'professional']));

-- tenant_settings, tenant_integrations, subscriptions, tenant_features:
-- "Configuración y políticas" / "Mercado Pago" / "Plan y facturación" son
-- Total para admin y No para el resto (matriz 4.1).
alter table tenant_settings enable row level security;
create policy tenant_settings_select on tenant_settings
  for select using (has_role(tenant_id, array['admin']));
create policy tenant_settings_update on tenant_settings
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));

alter table tenant_integrations enable row level security;
create policy tenant_integrations_select on tenant_integrations
  for select using (has_role(tenant_id, array['admin']));

alter table subscriptions enable row level security;
create policy subscriptions_select on subscriptions
  for select using (has_role(tenant_id, array['admin']));

alter table tenant_features enable row level security;
create policy tenant_features_select on tenant_features
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));

-- tenant_members: todo el staff activo puede ver quién compone el equipo;
-- solo admin gestiona altas/bajas/roles.
alter table tenant_members enable row level security;
create policy tenant_members_select on tenant_members
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy tenant_members_insert on tenant_members
  for insert with check (has_role(tenant_id, array['admin']));
create policy tenant_members_update on tenant_members
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));
create policy tenant_members_delete on tenant_members
  for delete using (has_role(tenant_id, array['admin']));

alter table invitations enable row level security;
create policy invitations_select on invitations
  for select using (has_role(tenant_id, array['admin']));
create policy invitations_insert on invitations
  for insert with check (has_role(tenant_id, array['admin']));
create policy invitations_update on invitations
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));

-- staff, horarios y bloqueos: cualquier miembro activo del tenant los ve
-- (hace falta para pintar la agenda); solo admin los da de alta o edita.
alter table staff enable row level security;
create policy staff_select on staff
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy staff_insert on staff
  for insert with check (has_role(tenant_id, array['admin']));
create policy staff_update on staff
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));

alter table business_hours enable row level security;
create policy business_hours_select on business_hours
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy business_hours_insert on business_hours
  for insert with check (has_role(tenant_id, array['admin']));
create policy business_hours_update on business_hours
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));
create policy business_hours_delete on business_hours
  for delete using (has_role(tenant_id, array['admin']));

alter table staff_schedules enable row level security;
create policy staff_schedules_select on staff_schedules
  for select using (
    exists (
      select 1 from staff s
      where s.id = staff_schedules.staff_id
        and has_role(s.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );
create policy staff_schedules_insert on staff_schedules
  for insert with check (
    exists (
      select 1 from staff s
      where s.id = staff_schedules.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );
create policy staff_schedules_update on staff_schedules
  for update using (
    exists (
      select 1 from staff s
      where s.id = staff_schedules.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );
create policy staff_schedules_delete on staff_schedules
  for delete using (
    exists (
      select 1 from staff s
      where s.id = staff_schedules.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );

alter table time_blocks enable row level security;
create policy time_blocks_select on time_blocks
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy time_blocks_insert on time_blocks
  for insert with check (has_role(tenant_id, array['admin', 'receptionist']));
create policy time_blocks_delete on time_blocks
  for delete using (has_role(tenant_id, array['admin', 'receptionist']));

alter table staff_services enable row level security;
create policy staff_services_select on staff_services
  for select using (
    exists (
      select 1 from staff s
      where s.id = staff_services.staff_id
        and has_role(s.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );
create policy staff_services_insert on staff_services
  for insert with check (
    exists (
      select 1 from staff s
      where s.id = staff_services.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );
create policy staff_services_update on staff_services
  for update using (
    exists (
      select 1 from staff s
      where s.id = staff_services.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );
create policy staff_services_delete on staff_services
  for delete using (
    exists (
      select 1 from staff s
      where s.id = staff_services.staff_id
        and has_role(s.tenant_id, array['admin'])
    )
  );
