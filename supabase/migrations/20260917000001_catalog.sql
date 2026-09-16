-- Modelo de datos, sección 3.4 Catálogo.

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  category_id uuid references service_categories (id) on delete set null,
  name text not null,
  description text,
  photo_url text,
  price numeric(12, 2) not null,
  buffer_after_min integer not null default 0,
  active boolean not null default true,
  public boolean not null default true,
  sort integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duración del servicio = suma de fases (sección 3.4).
create table service_phases (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('active', 'wait')),
  minutes integer not null check (minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, position)
);

create table products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  price numeric(12, 2) not null,
  category text,
  sku text,
  low_stock_threshold integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

-- Stock del producto = suma de movimientos (sección 3.4). appointment_id se
-- agrega en la migración de turnos (ALTER TABLE), igual que se hizo con
-- staff_services.service_id en la Fase 0.
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete cascade,
  qty integer not null check (qty <> 0),
  reason text not null,
  appointment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cierra el FK diferido de la Fase 0 (supabase/migrations/20260916000005).
alter table staff_services
  add constraint staff_services_service_id_fkey
  foreign key (service_id) references services (id) on delete cascade;

create index services_tenant_id_idx on services (tenant_id);
create index service_categories_tenant_id_idx on service_categories (tenant_id);
create index service_phases_service_id_idx on service_phases (service_id);
create index products_tenant_id_idx on products (tenant_id);
create index stock_movements_product_id_idx on stock_movements (product_id);

create trigger set_updated_at before update on service_categories
  for each row execute function set_updated_at();
create trigger set_updated_at before update on services
  for each row execute function set_updated_at();
create trigger set_updated_at before update on service_phases
  for each row execute function set_updated_at();
create trigger set_updated_at before update on products
  for each row execute function set_updated_at();
create trigger set_updated_at before update on stock_movements
  for each row execute function set_updated_at();

alter table service_categories enable row level security;
create policy service_categories_select on service_categories
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy service_categories_insert on service_categories
  for insert with check (has_role(tenant_id, array['admin']));
create policy service_categories_update on service_categories
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));
create policy service_categories_delete on service_categories
  for delete using (has_role(tenant_id, array['admin']));

alter table services enable row level security;
create policy services_select on services
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy services_insert on services
  for insert with check (has_role(tenant_id, array['admin']));
create policy services_update on services
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));

alter table service_phases enable row level security;
create policy service_phases_select on service_phases
  for select using (
    exists (
      select 1 from services s
      where s.id = service_phases.service_id
        and has_role(s.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );
create policy service_phases_insert on service_phases
  for insert with check (
    exists (
      select 1 from services s
      where s.id = service_phases.service_id and has_role(s.tenant_id, array['admin'])
    )
  );
create policy service_phases_update on service_phases
  for update using (
    exists (
      select 1 from services s
      where s.id = service_phases.service_id and has_role(s.tenant_id, array['admin'])
    )
  );
create policy service_phases_delete on service_phases
  for delete using (
    exists (
      select 1 from services s
      where s.id = service_phases.service_id and has_role(s.tenant_id, array['admin'])
    )
  );

alter table products enable row level security;
create policy products_select on products
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy products_insert on products
  for insert with check (has_role(tenant_id, array['admin']));
create policy products_update on products
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));

alter table stock_movements enable row level security;
create policy stock_movements_select on stock_movements
  for select using (
    exists (
      select 1 from products p
      where p.id = stock_movements.product_id
        and has_role(p.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );
