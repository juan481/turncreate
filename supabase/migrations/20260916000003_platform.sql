-- Modelo de datos, sección 3.1 Plataforma. Estas tablas no llevan tenant_id.

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('support', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_monthly numeric(12, 2) not null,
  price_yearly numeric(12, 2) not null,
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table business_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (
    slug in (
      'barberia', 'peluqueria', 'cosmiatria', 'unas',
      'pestanas', 'depilacion', 'spa', 'otro'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table service_templates (
  id uuid primary key default gen_random_uuid(),
  business_type_id uuid not null references business_types (id) on delete cascade,
  name text not null,
  price_suggested numeric(12, 2) not null,
  phases jsonb not null default '[]'::jsonb,
  buffer_min integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country, date)
);

-- Sin FK a tenants: audita acciones de plataforma sobre cualquier local,
-- y el registro debe sobrevivir aunque cambie el ciclo de vida del tenant.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  tenant_id uuid,
  action text not null,
  target text not null,
  diff jsonb,
  impersonated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create trigger set_updated_at before update on platform_admins
  for each row execute function set_updated_at();
create trigger set_updated_at before update on plans
  for each row execute function set_updated_at();
create trigger set_updated_at before update on business_types
  for each row execute function set_updated_at();
create trigger set_updated_at before update on service_templates
  for each row execute function set_updated_at();
create trigger set_updated_at before update on holidays
  for each row execute function set_updated_at();
create trigger set_updated_at before update on audit_logs
  for each row execute function set_updated_at();
create trigger set_updated_at before update on webhook_events
  for each row execute function set_updated_at();
