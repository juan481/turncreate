-- Modelo de datos, sección 3.2 Tenant y cuenta.

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  business_type_id uuid not null references business_types (id),
  timezone text not null default 'America/Argentina/Buenos_Aires',
  currency text not null default 'ARS',
  logo_url text,
  status text not null default 'trial'
    check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants (id) on delete cascade,
  deposit_type text not null default 'none'
    check (deposit_type in ('percent', 'fixed', 'none')),
  deposit_value numeric(12, 2) not null default 0,
  deposit_min numeric(12, 2) not null default 0,
  cancel_window_hours integer not null default 24,
  deposit_on_cancel text not null default 'refund'
    check (deposit_on_cancel in ('refund', 'credit', 'keep')),
  slot_interval_min integer not null default 15,
  booking_horizon_days integer not null default 60,
  min_notice_min integer not null default 60,
  books_by_staff boolean not null default true,
  reminder_hours integer not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  provider text not null,
  mp_user_id text,
  vault_secret_id uuid,
  expires_at timestamptz,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  plan_id uuid not null references plans (id),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  mp_preapproval_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_features (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  feature text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, feature)
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'receptionist', 'professional')),
  status text not null default 'active' check (status in ('active', 'invited', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_members_tenant_id_idx on tenant_members (tenant_id);
create index tenant_members_user_id_idx on tenant_members (user_id);

create trigger set_updated_at before update on tenants
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tenant_settings
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tenant_integrations
  for each row execute function set_updated_at();
create trigger set_updated_at before update on subscriptions
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tenant_features
  for each row execute function set_updated_at();
create trigger set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tenant_members
  for each row execute function set_updated_at();
