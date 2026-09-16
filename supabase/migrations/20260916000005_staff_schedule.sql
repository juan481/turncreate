-- Modelo de datos, sección 3.3 Staff y horarios.

create table staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  member_id uuid references tenant_members (id) on delete set null,
  display_name text not null,
  photo_url text,
  color text,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- staff_id nulo = bloqueo de todo el local.
create table time_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  staff_id uuid references staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- service_id sin FK todavía: la tabla `services` se crea recién en la
-- Fase 1 (sección 3.4 del plan). El FK se agrega en esa migración con
-- ALTER TABLE. No se pierde integridad de tenant: la app valida el
-- service_id contra el catálogo del mismo tenant hasta que exista el FK.
create table staff_services (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  service_id uuid not null,
  price_override numeric(12, 2),
  duration_override integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (staff_id, service_id)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  role text not null check (role in ('admin', 'receptionist', 'professional')),
  staff_id uuid references staff (id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'email')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index staff_tenant_id_idx on staff (tenant_id);
create index business_hours_tenant_id_idx on business_hours (tenant_id);
create index staff_schedules_staff_id_idx on staff_schedules (staff_id);
create index time_blocks_tenant_id_idx on time_blocks (tenant_id);
create index time_blocks_staff_id_idx on time_blocks (staff_id);
create index staff_services_staff_id_idx on staff_services (staff_id);
create index invitations_tenant_id_idx on invitations (tenant_id);

create trigger set_updated_at before update on staff
  for each row execute function set_updated_at();
create trigger set_updated_at before update on business_hours
  for each row execute function set_updated_at();
create trigger set_updated_at before update on staff_schedules
  for each row execute function set_updated_at();
create trigger set_updated_at before update on time_blocks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on staff_services
  for each row execute function set_updated_at();
create trigger set_updated_at before update on invitations
  for each row execute function set_updated_at();
