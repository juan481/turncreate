-- Seed de entorno local (sección 2.2): 2 locales de prueba, uno con
-- varios profesionales y uno unipersonal. No crea usuarios de auth.users
-- a propósito -- para probar el login real, registrate desde /registro.
-- Los nombres de "Studio Lumière" y el staff salen de las pantallas de
-- referencia (Pantallas - Referencias/turncreate_agenda_ficha_*) para que
-- lo que se ve en /app/[tenant] coincida con los mockups.

insert into business_types (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Cosmiatría y estética', 'cosmiatria'),
  ('00000000-0000-0000-0000-000000000002', 'Barbería', 'barberia');

insert into plans (name, price_monthly, price_yearly, limits, features) values
  ('Solo', 15, 150, '{"professionals": 1, "locations": 1}', '{"reception": false}'),
  ('Equipo', 35, 350, '{"professionals": 5, "locations": 1}', '{"reception": true, "cash_register": true}'),
  ('Pro', 69, 690, '{"professionals": 15, "locations": 2}', '{"reception": true, "cash_register": true, "reports": true}');

-- Tenant A: con profesionales.
insert into tenants (id, name, slug, business_type_id, status) values (
  '10000000-0000-0000-0000-000000000001',
  'Studio Lumière',
  'studio-lumiere',
  '00000000-0000-0000-0000-000000000001',
  'active'
);

insert into tenant_settings (
  tenant_id, deposit_type, deposit_value, deposit_min, books_by_staff
) values (
  '10000000-0000-0000-0000-000000000001', 'percent', 50, 5000, true
);

insert into business_hours (tenant_id, weekday, opens_at, closes_at)
select '10000000-0000-0000-0000-000000000001', weekday, '09:00', '19:00'
from generate_series(1, 6) as weekday;

insert into staff (tenant_id, display_name, color) values
  ('10000000-0000-0000-0000-000000000001', 'Lucía Valenzuela', '#7069E8'),
  ('10000000-0000-0000-0000-000000000001', 'Ana Martínez', '#22C55E'),
  ('10000000-0000-0000-0000-000000000001', 'Lucas Torres', '#F59E0B'),
  ('10000000-0000-0000-0000-000000000001', 'Carolina Ríos', '#EF4444');

-- Tenant B: unipersonal (el dueño es el único profesional).
insert into tenants (id, name, slug, business_type_id, status) values (
  '10000000-0000-0000-0000-000000000002',
  'Barbería del Centro',
  'barberia-del-centro',
  '00000000-0000-0000-0000-000000000002',
  'trial'
);

insert into tenant_settings (
  tenant_id, deposit_type, deposit_value, deposit_min, books_by_staff
) values (
  '10000000-0000-0000-0000-000000000002', 'none', 0, 0, false
);

insert into business_hours (tenant_id, weekday, opens_at, closes_at)
select '10000000-0000-0000-0000-000000000002', weekday, '10:00', '20:00'
from generate_series(2, 6) as weekday;

insert into staff (tenant_id, display_name) values
  ('10000000-0000-0000-0000-000000000002', 'Martín Gómez');
