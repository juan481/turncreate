-- Sección 3.7 Dinero (Fase 5): payments, sale_items, cash_sessions,
-- cash_movements, commission_rules, commission_entries, commission_payouts.
-- Reemplaza el intento roto de la migración descartada (ADR 0004): esta
-- sigue el modelo de datos real del plan, no cash_registers/transactions
-- inventados, y no vuelve a crear `products` (ya existe desde la Fase 1).

create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  opened_by uuid not null references auth.users (id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(12, 2) not null default 0,
  closed_by uuid references auth.users (id),
  closed_at timestamptz,
  expected_amount numeric(12, 2),
  counted_amount numeric(12, 2),
  difference numeric(12, 2),
  difference_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  appointment_id uuid references appointments (id),
  kind text not null check (kind in ('deposit', 'balance', 'product', 'refund')),
  method text not null check (method in ('mercadopago', 'cash', 'card_posnet', 'transfer')),
  amount numeric(12, 2) not null,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'refunded')),
  mp_payment_id text,
  cash_session_id uuid references cash_sessions (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sale_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  product_id uuid not null references products (id),
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Solo efectivo real de cajón -- un pago con tarjeta/transferencia/MP no
-- genera movimiento acá (sección 5.5: "Solo el efectivo entra al
-- arqueo"). payment_id nulo = movimiento suelto (retiro, gasto de
-- insumos, etc.), no ligado a un cobro de turno.
create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references cash_sessions (id) on delete cascade,
  type text not null check (type in ('in', 'out')),
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null,
  payment_id uuid references payments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Regla más específica gana: servicio > categoría > profesional
-- (sección 5.5). null en las tres columnas de alcance = no debería
-- pasar en la práctica, pero no se prohíbe a nivel de constraint.
create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  staff_id uuid references staff (id) on delete cascade,
  service_id uuid references services (id) on delete cascade,
  category_id uuid references service_categories (id) on delete cascade,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table commission_payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  staff_id uuid not null references staff (id),
  period_from date not null,
  period_to date not null,
  total numeric(12, 2) not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table commission_entries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id),
  staff_id uuid not null references staff (id),
  base_amount numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  payout_id uuid references commission_payouts (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cash_sessions_tenant_id_idx on cash_sessions (tenant_id);
create index payments_appointment_id_idx on payments (appointment_id);
create index payments_tenant_id_idx on payments (tenant_id);
create index sale_items_appointment_id_idx on sale_items (appointment_id);
create index cash_movements_cash_session_id_idx on cash_movements (cash_session_id);
create index commission_rules_tenant_id_idx on commission_rules (tenant_id);
create index commission_entries_staff_id_idx on commission_entries (staff_id);

create trigger set_updated_at before update on cash_sessions
  for each row execute function set_updated_at();
create trigger set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger set_updated_at before update on sale_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on cash_movements
  for each row execute function set_updated_at();
create trigger set_updated_at before update on commission_rules
  for each row execute function set_updated_at();
create trigger set_updated_at before update on commission_payouts
  for each row execute function set_updated_at();
create trigger set_updated_at before update on commission_entries
  for each row execute function set_updated_at();

-- RLS. Escritura solo por RPC (sección 4.2): sin policies de insert acá,
-- salvo donde se anota lo contrario.
alter table cash_sessions enable row level security;
create policy cash_sessions_select on cash_sessions
  for select using (has_role(tenant_id, array['admin', 'receptionist']));

alter table payments enable row level security;
create policy payments_select on payments
  for select using (has_role(tenant_id, array['admin', 'receptionist']));

alter table sale_items enable row level security;
create policy sale_items_select on sale_items
  for select using (
    exists (
      select 1 from appointments a
      where a.id = sale_items.appointment_id and has_role(a.tenant_id, array['admin', 'receptionist'])
    )
  );

alter table cash_movements enable row level security;
create policy cash_movements_select on cash_movements
  for select using (
    exists (
      select 1 from cash_sessions cs
      where cs.id = cash_movements.cash_session_id and has_role(cs.tenant_id, array['admin', 'receptionist'])
    )
  );

alter table commission_rules enable row level security;
create policy commission_rules_select on commission_rules
  for select using (has_role(tenant_id, array['admin']));
create policy commission_rules_insert on commission_rules
  for insert with check (has_role(tenant_id, array['admin']));
create policy commission_rules_update on commission_rules
  for update using (has_role(tenant_id, array['admin']))
  with check (has_role(tenant_id, array['admin']));
create policy commission_rules_delete on commission_rules
  for delete using (has_role(tenant_id, array['admin']));

alter table commission_payouts enable row level security;
create policy commission_payouts_select on commission_payouts
  for select using (has_role(tenant_id, array['admin']));

-- Comisiones: Total (admin) / Ver la propia, si el local lo habilita
-- (profesional) -- sección 4.1. La habilitación por tenant_features
-- queda para cuando la UI de comisiones del profesional exista; por
-- ahora el profesional ya puede ver la propia.
alter table commission_entries enable row level security;
create policy commission_entries_select on commission_entries
  for select using (
    exists (
      select 1 from staff s
      where s.id = commission_entries.staff_id
        and (
          has_role(s.tenant_id, array['admin'])
          or (has_role(s.tenant_id, array['professional']) and s.id = my_staff_id(s.tenant_id))
        )
    )
  );

-- Sección 4.2: "Caja del día: Total (admin) / Abrir, ver y cerrar
-- (recepcionista)". No distingue en RLS "del día" vs "histórica" --
-- eso lo filtra la UI; acá alcanza con admin/recepción para abrir/cerrar.
create or replace function open_cash_session(p_tenant_id uuid, p_opening_amount numeric)
returns cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session cash_sessions;
begin
  if not has_role(p_tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para abrir caja';
  end if;

  if exists (select 1 from cash_sessions where tenant_id = p_tenant_id and closed_at is null) then
    raise exception 'Ya hay una caja abierta';
  end if;

  insert into cash_sessions (tenant_id, opened_by, opening_amount)
  values (p_tenant_id, auth.uid(), p_opening_amount)
  returning * into v_session;

  return v_session;
end;
$$;

revoke execute on function open_cash_session(uuid, numeric) from public;
grant execute on function open_cash_session(uuid, numeric) to authenticated;

create or replace function close_cash_session(
  p_session_id uuid,
  p_counted_amount numeric,
  p_difference_reason text default null
)
returns cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session cash_sessions;
  v_expected numeric(12, 2);
begin
  select * into v_session from cash_sessions where id = p_session_id;
  if not found then
    raise exception 'Caja no encontrada';
  end if;
  if not has_role(v_session.tenant_id, array['admin', 'receptionist']) then
    raise exception 'Sin permiso para cerrar caja';
  end if;
  if v_session.closed_at is not null then
    raise exception 'Esa caja ya está cerrada';
  end if;

  select v_session.opening_amount + coalesce(
    sum(case when type = 'in' then amount else -amount end), 0
  )
  into v_expected
  from cash_movements
  where cash_session_id = p_session_id;

  if p_counted_amount <> v_expected and coalesce(trim(p_difference_reason), '') = '' then
    raise exception 'Si hay diferencia en el arqueo, el motivo es obligatorio';
  end if;

  update cash_sessions
  set closed_by = auth.uid(),
      closed_at = now(),
      expected_amount = v_expected,
      counted_amount = p_counted_amount,
      difference = p_counted_amount - v_expected,
      difference_reason = p_difference_reason
  where id = p_session_id
  returning * into v_session;

  return v_session;
end;
$$;

revoke execute on function close_cash_session(uuid, numeric, text) from public;
grant execute on function close_cash_session(uuid, numeric, text) to authenticated;

-- Sección 5.5: registra los pagos (varios métodos posibles), agrega
-- productos y descuenta stock, genera comisiones, pasa a completed.
-- Simplificación: la comisión se calcula con la regla del primer
-- servicio del turno (la UI de creación de turnos todavía no arma
-- combos de varios servicios reales, sección 3.6/ADR 0002).
create or replace function finalize_appointment(
  p_appointment_id uuid,
  p_payments jsonb,
  p_sale_items jsonb default '[]'::jsonb,
  p_cash_session_id uuid default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_payment jsonb;
  v_sale_item jsonb;
  v_payment_id uuid;
  v_commission_rule commission_rules;
  v_commission_amount numeric(12, 2);
  v_service_total numeric(12, 2);
  v_first_service_id uuid;
  v_first_category_id uuid;
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
    raise exception 'Sin permiso para cobrar este turno';
  end if;

  if v_appointment.status <> 'confirmed' then
    raise exception 'Solo se pueden finalizar turnos confirmados';
  end if;

  for v_payment in select * from jsonb_array_elements(p_payments) loop
    if (v_payment ->> 'method') = 'cash' and p_cash_session_id is null then
      raise exception 'Falta la caja abierta para registrar un pago en efectivo';
    end if;

    insert into payments (tenant_id, appointment_id, kind, method, amount, status, mp_payment_id, cash_session_id)
    values (
      v_appointment.tenant_id, p_appointment_id, 'balance',
      v_payment ->> 'method', (v_payment ->> 'amount')::numeric, 'approved',
      v_payment ->> 'mp_payment_id',
      case when (v_payment ->> 'method') = 'cash' then p_cash_session_id else null end
    )
    returning id into v_payment_id;

    if (v_payment ->> 'method') = 'cash' then
      insert into cash_movements (cash_session_id, type, amount, reason, payment_id)
      values (p_cash_session_id, 'in', (v_payment ->> 'amount')::numeric, 'Cobro de turno', v_payment_id);
    end if;
  end loop;

  for v_sale_item in select * from jsonb_array_elements(p_sale_items) loop
    insert into sale_items (appointment_id, product_id, qty, unit_price)
    values (
      p_appointment_id,
      (v_sale_item ->> 'product_id')::uuid,
      (v_sale_item ->> 'qty')::integer,
      (v_sale_item ->> 'unit_price')::numeric
    );

    insert into stock_movements (product_id, qty, reason, appointment_id)
    values (
      (v_sale_item ->> 'product_id')::uuid,
      -(v_sale_item ->> 'qty')::integer,
      'Venta en turno',
      p_appointment_id
    );
  end loop;

  select coalesce(sum(price), 0) into v_service_total
  from appointment_items where appointment_id = p_appointment_id;

  select service_id into v_first_service_id
  from appointment_items where appointment_id = p_appointment_id limit 1;

  select category_id into v_first_category_id
  from services where id = v_first_service_id;

  select cr.* into v_commission_rule
  from commission_rules cr
  where cr.tenant_id = v_appointment.tenant_id
    and (
      cr.service_id = v_first_service_id
      or cr.category_id = v_first_category_id
      or cr.staff_id = v_appointment.staff_id
    )
  order by
    case
      when cr.service_id is not null then 1
      when cr.category_id is not null then 2
      when cr.staff_id is not null then 3
    end
  limit 1;

  if v_commission_rule.id is not null then
    v_commission_amount := case
      when v_commission_rule.type = 'percent' then v_service_total * (v_commission_rule.value / 100)
      else v_commission_rule.value
    end;

    insert into commission_entries (appointment_id, staff_id, base_amount, amount)
    values (p_appointment_id, v_appointment.staff_id, v_service_total, v_commission_amount);
  end if;

  update appointments set status = 'completed' where id = p_appointment_id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, from_status, to_status, actor_id)
  values (p_appointment_id, 'confirmed', 'completed', auth.uid());

  return v_appointment;
end;
$$;

revoke execute on function finalize_appointment(uuid, jsonb, jsonb, uuid) from public;
grant execute on function finalize_appointment(uuid, jsonb, jsonb, uuid) to authenticated;
