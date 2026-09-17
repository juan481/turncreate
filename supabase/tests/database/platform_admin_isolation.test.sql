-- La consola de plataforma (sección 4.3) depende enteramente de que un
-- usuario común no pueda verse a sí mismo (ni a nadie) como
-- platform_admin. src/server/platform.ts::isPlatformAdmin() protege el
-- layout de /platform y la Server Action que suspende/activa tenants
-- (createAdminClient bypassa RLS) consultando esta tabla con el cliente
-- normal -- si la policy fallara abierta, cualquier usuario autenticado
-- podría escalar a control total de la plataforma.
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

set local role postgres;

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  (
    'dddddddd-1111-0000-0000-000000000001', 'usuario-normal@test.local',
    crypt('password123', gen_salt('bf')), now(), '{}', '{}'
  ),
  (
    'dddddddd-1111-0000-0000-000000000002', 'platform-admin@test.local',
    crypt('password123', gen_salt('bf')), now(), '{}', '{}'
  );

insert into platform_admins (user_id, level)
values ('dddddddd-1111-0000-0000-000000000002', 'admin');

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"dddddddd-1111-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from platform_admins),
  0,
  'un usuario sin fila en platform_admins no ve ninguna (ni la propia ausencia ni la de otros)'
);

set local "request.jwt.claims" = '{"sub":"dddddddd-1111-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from platform_admins),
  1,
  'un platform_admin real se ve a sí mismo (y solo a sí mismo)'
);

select finish();
rollback;
