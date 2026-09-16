-- Modelo de datos, sección 3.5 Clientes.

create table clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  full_name text not null,
  phone_e164 text not null,
  email text,
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  marketing_opt_in boolean not null default false,
  no_show_count integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone_e164)
);

-- is_clinical: sección 8.3, consentimiento aparte para notas clínicas en
-- rubros de estética/salud, con acceso restringido (matriz 4.1: "Notas
-- clínicas: Total / No / Solo de clientes que atendió / No").
create table client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  author_id uuid not null references auth.users (id),
  body text not null,
  is_clinical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table client_tags (
  client_id uuid not null references clients (id) on delete cascade,
  tag_id uuid not null references tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, tag_id)
);

create index clients_tenant_id_idx on clients (tenant_id);
create index client_notes_client_id_idx on client_notes (client_id);
create index tags_tenant_id_idx on tags (tenant_id);

create trigger set_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger set_updated_at before update on client_notes
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tags
  for each row execute function set_updated_at();

alter table clients enable row level security;
create policy clients_select on clients
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy clients_insert on clients
  for insert with check (has_role(tenant_id, array['admin', 'receptionist']));
create policy clients_update on clients
  for update using (has_role(tenant_id, array['admin', 'receptionist']))
  with check (has_role(tenant_id, array['admin', 'receptionist']));

-- client_notes_select se agrega en la migración de turnos: el profesional
-- solo ve notas de clientes que atendió, y eso requiere consultar
-- appointments (sección 3.6), que todavía no existe en este punto.
alter table client_notes enable row level security;
create policy client_notes_insert on client_notes
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from clients c
      where c.id = client_notes.client_id
        and has_role(c.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );

alter table tags enable row level security;
create policy tags_select on tags
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));
create policy tags_insert on tags
  for insert with check (has_role(tenant_id, array['admin', 'receptionist']));

alter table client_tags enable row level security;
create policy client_tags_select on client_tags
  for select using (
    exists (
      select 1 from clients c
      where c.id = client_tags.client_id
        and has_role(c.tenant_id, array['admin', 'receptionist', 'professional'])
    )
  );
create policy client_tags_insert on client_tags
  for insert with check (
    exists (
      select 1 from clients c
      where c.id = client_tags.client_id
        and has_role(c.tenant_id, array['admin', 'receptionist'])
    )
  );
create policy client_tags_delete on client_tags
  for delete using (
    exists (
      select 1 from clients c
      where c.id = client_tags.client_id
        and has_role(c.tenant_id, array['admin', 'receptionist'])
    )
  );
