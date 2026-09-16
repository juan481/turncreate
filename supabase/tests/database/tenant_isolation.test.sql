-- Criterio de "terminado" de la Fase 0 (plan maestro, sección 7):
-- "usuarios de dos locales no se ven entre sí". Corre autocontenido
-- (crea y hace rollback de sus propios datos) para no depender del seed.
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

set local role postgres;

insert into business_types (id, name, slug)
values ('eeeeeeee-0000-0000-0000-000000000001', 'Test', 'otro')
on conflict (slug) do nothing;

insert into tenants (id, name, slug, business_type_id, status)
values
  (
    'eeeeeeee-0000-0000-0000-00000000000a', 'Tenant Test A', 'tenant-test-a',
    (select id from business_types where slug = 'otro'), 'active'
  ),
  (
    'eeeeeeee-0000-0000-0000-00000000000b', 'Tenant Test B', 'tenant-test-b',
    (select id from business_types where slug = 'otro'), 'active'
  );

insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data
)
values
  (
    'eeeeeeee-1111-0000-0000-000000000001', 'user-a@test.local',
    crypt('password123', gen_salt('bf')), now(), '{}', '{}'
  ),
  (
    'eeeeeeee-1111-0000-0000-000000000002', 'user-b@test.local',
    crypt('password123', gen_salt('bf')), now(), '{}', '{}'
  );

insert into tenant_members (tenant_id, user_id, role, status) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'eeeeeeee-1111-0000-0000-000000000001', 'admin', 'active'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'eeeeeeee-1111-0000-0000-000000000002', 'admin', 'active');

insert into staff (tenant_id, display_name) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'Staff de A'),
  ('eeeeeeee-0000-0000-0000-00000000000b', 'Staff de B');

-- Sesión del usuario A (rol authenticated + JWT simulado, igual que en runtime).
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"eeeeeeee-1111-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from tenants where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  1,
  'user A ve su propio tenant'
);
select is(
  (select count(*)::int from tenants where id = 'eeeeeeee-0000-0000-0000-00000000000b'),
  0,
  'user A NO ve el tenant B'
);
select is(
  (select count(*)::int from staff where tenant_id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  1,
  'user A ve el staff de su tenant'
);
select is(
  (select count(*)::int from staff where tenant_id = 'eeeeeeee-0000-0000-0000-00000000000b'),
  0,
  'user A NO ve el staff del tenant B'
);

-- Sesión del usuario B: la misma prueba, en el sentido inverso.
set local "request.jwt.claims" = '{"sub":"eeeeeeee-1111-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from tenants where id = 'eeeeeeee-0000-0000-0000-00000000000b'),
  1,
  'user B ve su propio tenant'
);
select is(
  (select count(*)::int from tenants where id = 'eeeeeeee-0000-0000-0000-00000000000a'),
  0,
  'user B NO ve el tenant A'
);

select finish();
rollback;
