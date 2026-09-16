-- Sección 5.2: "appointment_segments tiene EXCLUDE USING gist (staff_id
-- WITH =, period WITH &&)... Si dos reservas chocan, la segunda falla en
-- la base." Esta es la pieza de mayor riesgo técnico del plan: se prueba
-- directamente contra la base, no solo en el dominio TS.
begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

set local role postgres;

insert into business_types (id, name, slug)
values ('ffffffff-0000-0000-0000-000000000001', 'Test', 'otro')
on conflict (slug) do nothing;

insert into tenants (id, name, slug, business_type_id, status)
values (
  'ffffffff-0000-0000-0000-00000000000a', 'Tenant Booking', 'tenant-booking-test',
  (select id from business_types where slug = 'otro'), 'active'
);

insert into staff (id, tenant_id, display_name)
values ('ffffffff-0000-0000-0000-00000000000b', 'ffffffff-0000-0000-0000-00000000000a', 'Staff Booking');

insert into clients (id, tenant_id, full_name, phone_e164)
values ('ffffffff-0000-0000-0000-00000000000c', 'ffffffff-0000-0000-0000-00000000000a', 'Cliente Test', '+5491100000000');

insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source)
values (
  'ffffffff-0000-0000-0000-00000000000d', 'ffffffff-0000-0000-0000-00000000000a',
  'ffffffff-0000-0000-0000-00000000000c', 'ffffffff-0000-0000-0000-00000000000b',
  '2026-10-01 10:00+00', '2026-10-01 10:30+00', 'confirmed', 'staff'
);

insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
values (
  'ffffffff-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-00000000000d',
  'ffffffff-0000-0000-0000-00000000000b', tstzrange('2026-10-01 10:00+00', '2026-10-01 10:30+00', '[)')
);

select lives_ok(
  $$ insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
     values ('ffffffff-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-00000000000d',
             'ffffffff-0000-0000-0000-00000000000b',
             tstzrange('2026-10-01 10:30+00', '2026-10-01 11:00+00', '[)')) $$,
  'un tramo consecutivo (sin superposición) para el mismo profesional se permite'
);

select throws_ok(
  $$ insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
     values ('ffffffff-0000-0000-0000-00000000000a', 'ffffffff-0000-0000-0000-00000000000d',
             'ffffffff-0000-0000-0000-00000000000b',
             tstzrange('2026-10-01 10:15+00', '2026-10-01 10:45+00', '[)')) $$,
  '23P01',
  null,
  'un tramo superpuesto con otro del mismo profesional es rechazado por el EXCLUDE constraint'
);

select finish();
rollback;
