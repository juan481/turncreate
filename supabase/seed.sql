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

insert into staff (id, tenant_id, display_name, color) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lucía Valenzuela', '#7069E8'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ana Martínez', '#22C55E'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Lucas Torres', '#F59E0B'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Carolina Ríos', '#EF4444');

-- Mismo horario que el local, lunes a sábado, sin fecha de fin.
insert into staff_schedules (staff_id, weekday, starts_at, ends_at, valid_from)
select s.id, weekday, '09:00', '19:00', '2026-01-01'
from staff s, generate_series(1, 6) as weekday
where s.tenant_id = '10000000-0000-0000-0000-000000000001';

insert into service_categories (id, tenant_id, name, sort) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Facial & Cosmiatría', 1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Pelo & Barber', 2);

insert into services (id, tenant_id, category_id, name, description, price, buffer_after_min) values
  (
    '31000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'Limpieza Facial Profunda',
    'Higiene ultrasónica, extracción cuidadosa e hidratación.', 24000, 5
  ),
  (
    -- El mismo ejemplo de fases que usa la sección 5.1 del plan maestro:
    -- 30 aplicación + 40 espera + 20 lavado, 10 de buffer.
    '31000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001', 'Coloración con Tiempo de Espera',
    'Aplicación de color, tiempo de procesamiento y lavado final.', 32000, 10
  );

insert into service_phases (service_id, position, kind, minutes) values
  ('31000000-0000-0000-0000-000000000001', 1, 'active', 45),
  ('31000000-0000-0000-0000-000000000002', 1, 'active', 30),
  ('31000000-0000-0000-0000-000000000002', 2, 'wait', 40),
  ('31000000-0000-0000-0000-000000000002', 3, 'active', 20);

insert into staff_services (staff_id, service_id) values
  ('20000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002');

insert into clients (id, tenant_id, full_name, phone_e164, email) values
  (
    '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    'Camila Morales', '+5491144558822', 'camila.m@gmail.com'
  ),
  (
    '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    'Julieta Navarro', '+5491138214409', null
  );

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

insert into staff (id, tenant_id, display_name) values
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Martín Gómez');

insert into staff_schedules (staff_id, weekday, starts_at, ends_at, valid_from)
select '20000000-0000-0000-0000-000000000005', weekday, '10:00', '20:00', '2026-01-01'
from generate_series(2, 6) as weekday;
