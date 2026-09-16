-- Modelo de datos, sección 3.6 Turnos.

create table appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  client_id uuid not null references clients (id),
  staff_id uuid not null references staff (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (
    status in ('pending_payment', 'confirmed', 'expired', 'completed', 'no_show', 'cancelled')
  ),
  source text not null check (source in ('public', 'staff')),
  hold_expires_at timestamptz,
  total numeric(12, 2) not null default 0,
  deposit_required numeric(12, 2) not null default 0,
  deposit_paid numeric(12, 2) not null default 0,
  balance numeric(12, 2) not null default 0,
  manage_token_hash text,
  cancel_reason text,
  rescheduled_from_id uuid references appointments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- Copia de los datos del servicio al momento de reservar (sección 3.6):
-- si el precio o las fases del servicio cambian después, el turno ya
-- confirmado no se ve afectado.
create table appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  service_id uuid not null references services (id),
  name text not null,
  price numeric(12, 2) not null,
  phases jsonb not null default '[]'::jsonb,
  buffer_min integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sección 5.2: bloqueo de doble reserva a nivel de base. Solo contiene
-- tramos que realmente ocupan al profesional (fases activas + buffer, no
-- las esperas) de turnos vivos -- se borran cuando el turno se cancela,
-- expira o no se presenta (ver transition_appointment más abajo).
create table appointment_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  appointment_id uuid not null references appointments (id) on delete cascade,
  staff_id uuid not null references staff (id),
  period tstzrange not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  exclude using gist (staff_id with =, period with &&)
);

create table appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users (id),
  at timestamptz not null default now()
);

alter table stock_movements
  add constraint stock_movements_appointment_id_fkey
  foreign key (appointment_id) references appointments (id) on delete set null;

create index appointments_tenant_id_idx on appointments (tenant_id);
create index appointments_staff_id_starts_at_idx on appointments (staff_id, starts_at);
create index appointments_client_id_idx on appointments (client_id);
create index appointment_items_appointment_id_idx on appointment_items (appointment_id);
create index appointment_segments_appointment_id_idx on appointment_segments (appointment_id);
create index appointment_status_history_appointment_id_idx on appointment_status_history (appointment_id);

create trigger set_updated_at before update on appointments
  for each row execute function set_updated_at();
create trigger set_updated_at before update on appointment_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on appointment_segments
  for each row execute function set_updated_at();

-- balance es derivado (sección 5.5: "total − pagos registrados = saldo").
-- Hasta que exista el módulo de pagos (Fase 5) se aproxima con
-- deposit_paid; register_payment/finalize_appointment lo reemplazan.
create or replace function set_appointment_balance()
returns trigger
language plpgsql
as $$
begin
  new.balance = new.total - new.deposit_paid;
  return new;
end;
$$;

create trigger set_appointment_balance before insert or update
  on appointments for each row execute function set_appointment_balance();

alter table appointments enable row level security;
create policy appointments_select on appointments
  for select using (
    has_role(tenant_id, array['admin', 'receptionist'])
    or (has_role(tenant_id, array['professional']) and staff_id = my_staff_id(tenant_id))
  );

alter table appointment_items enable row level security;
create policy appointment_items_select on appointment_items
  for select using (
    exists (
      select 1 from appointments a
      where a.id = appointment_items.appointment_id
        and (
          has_role(a.tenant_id, array['admin', 'receptionist'])
          or (has_role(a.tenant_id, array['professional']) and a.staff_id = my_staff_id(a.tenant_id))
        )
    )
  );

alter table appointment_segments enable row level security;
create policy appointment_segments_select on appointment_segments
  for select using (has_role(tenant_id, array['admin', 'receptionist', 'professional']));

alter table appointment_status_history enable row level security;
create policy appointment_status_history_select on appointment_status_history
  for select using (
    exists (
      select 1 from appointments a
      where a.id = appointment_status_history.appointment_id
        and (
          has_role(a.tenant_id, array['admin', 'receptionist'])
          or (has_role(a.tenant_id, array['professional']) and a.staff_id = my_staff_id(a.tenant_id))
        )
    )
  );

-- Ahora que appointments existe: notas clínicas visibles solo para quien
-- atendió al cliente (matriz 4.1), además de admin/recepción con acceso total.
create policy client_notes_select on client_notes
  for select using (
    exists (
      select 1 from clients c
      where c.id = client_notes.client_id
        and (
          has_role(c.tenant_id, array['admin', 'receptionist'])
          or (
            has_role(c.tenant_id, array['professional'])
            and exists (
              select 1 from appointments a
              where a.client_id = c.id and a.staff_id = my_staff_id(c.tenant_id)
            )
          )
        )
    )
  );

-- Sección 4.2: "Estados de turno solo por transition_appointment(id,
-- to_status), que valida rol y transición y escribe el historial."
create or replace function transition_appointment(p_appointment_id uuid, p_to_status text)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_from_status text;
begin
  select * into v_appointment from appointments where id = p_appointment_id;
  if not found then
    raise exception 'Turno no encontrado';
  end if;

  if not (
    has_role(v_appointment.tenant_id, array['admin', 'receptionist'])
    or (
      has_role(v_appointment.tenant_id, array['professional'])
      and v_appointment.staff_id = my_staff_id(v_appointment.tenant_id)
    )
  ) then
    raise exception 'Sin permiso para cambiar este turno';
  end if;

  v_from_status := v_appointment.status;

  if (v_from_status, p_to_status) not in (
    ('pending_payment', 'confirmed'),
    ('pending_payment', 'expired'),
    ('pending_payment', 'cancelled'),
    ('confirmed', 'completed'),
    ('confirmed', 'no_show'),
    ('confirmed', 'cancelled')
  ) then
    raise exception 'Transición % -> % no permitida', v_from_status, p_to_status;
  end if;

  update appointments set status = p_to_status
  where id = p_appointment_id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (p_appointment_id, v_from_status, p_to_status, auth.uid());

  if p_to_status in ('cancelled', 'expired', 'no_show') then
    delete from appointment_segments where appointment_id = p_appointment_id;
  end if;

  if p_to_status = 'no_show' then
    update clients set no_show_count = no_show_count + 1 where id = v_appointment.client_id;
  end if;

  return v_appointment;
end;
$$;

revoke execute on function transition_appointment(uuid, text) from public;
grant execute on function transition_appointment(uuid, text) to authenticated;

-- Crea el turno completo (appointment + items + segments) en una sola
-- transacción. El motor de disponibilidad (src/domain/availability) ya
-- resolvió qué tramos ocupan al profesional del lado de la app; el
-- EXCLUDE constraint de appointment_segments es el árbitro final contra
-- condiciones de carrera (sección 5.2).
create or replace function create_staff_appointment(
  p_tenant_id uuid,
  p_staff_id uuid,
  p_client_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_items jsonb,
  p_segments jsonb
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_total numeric(12, 2);
  v_item jsonb;
  v_segment jsonb;
begin
  if not has_role(p_tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para crear turnos';
  end if;

  select coalesce(sum((i ->> 'price')::numeric), 0) into v_total
  from jsonb_array_elements(p_items) i;

  insert into appointments (tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total)
  values (p_tenant_id, p_client_id, p_staff_id, p_starts_at, p_ends_at, 'confirmed', 'staff', v_total)
  returning * into v_appointment;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into appointment_items (appointment_id, service_id, name, price, phases, buffer_min)
    values (
      v_appointment.id,
      (v_item ->> 'service_id')::uuid,
      v_item ->> 'name',
      (v_item ->> 'price')::numeric,
      coalesce(v_item -> 'phases', '[]'::jsonb),
      coalesce((v_item ->> 'buffer_min')::integer, 0)
    );
  end loop;

  for v_segment in select * from jsonb_array_elements(p_segments) loop
    insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
    values (
      p_tenant_id,
      v_appointment.id,
      p_staff_id,
      tstzrange((v_segment ->> 'starts_at')::timestamptz, (v_segment ->> 'ends_at')::timestamptz, '[)')
    );
  end loop;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (v_appointment.id, null, 'confirmed', auth.uid());

  return v_appointment;
end;
$$;

revoke execute on function create_staff_appointment(uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb) from public;
grant execute on function create_staff_appointment(uuid, uuid, uuid, timestamptz, timestamptz, jsonb, jsonb) to authenticated;

-- Sección 3.5: "Vista client_stats: total gastado, cantidad de turnos,
-- última visita". total_spent se aproxima con appointments.total de turnos
-- completed hasta que exista el módulo de pagos (Fase 5), donde se
-- reemplaza por la suma real de `payments`.
-- security_invoker: sin esto, una vista creada por una migración (dueño
-- `postgres`, que tiene BYPASSRLS) ignora el RLS de clients/appointments
-- para cualquiera que la consulte -- es el gotcha de seguridad más común
-- con vistas en Supabase.
create view client_stats
with (security_invoker = true) as
select
  c.id as client_id,
  c.tenant_id,
  count(a.id) filter (where a.status = 'completed') as appointments_count,
  coalesce(sum(a.total) filter (where a.status = 'completed'), 0) as total_spent,
  max(a.starts_at) filter (where a.status = 'completed') as last_visit_at
from clients c
left join appointments a on a.client_id = c.id
group by c.id, c.tenant_id;
