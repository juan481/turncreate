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

-- photo_url con fotos de stock consistentes (pravatar, seed fijo por
-- persona) -- da la sensación real de las pantallas de referencia sin
-- depender de assets propios.
insert into staff (id, tenant_id, display_name, color, photo_url) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Lucía Valenzuela', '#7069E8', 'https://i.pravatar.cc/150?u=lucia.valenzuela@studiolumiere'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Ana Martínez', '#22C55E', 'https://i.pravatar.cc/150?u=ana.martinez@studiolumiere'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Lucas Torres', '#F59E0B', 'https://i.pravatar.cc/150?u=lucas.torres@studiolumiere'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Carolina Ríos', '#EF4444', 'https://i.pravatar.cc/150?u=carolina.rios@studiolumiere');

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

-- Todos los días (0-6): es un unipersonal, abre cuando el dueño decide
-- trabajar -- y así los turnos de "hoy" del bloque de más abajo caen
-- siempre dentro del horario, sin importar qué día se corra este seed.
insert into business_hours (tenant_id, weekday, opens_at, closes_at)
select '10000000-0000-0000-0000-000000000002', weekday, '09:00', '20:00'
from generate_series(0, 6) as weekday;

insert into staff (id, tenant_id, display_name, photo_url) values
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Martín Gómez', 'https://i.pravatar.cc/150?u=martin.gomez@barberiadelcentro');

insert into staff_schedules (staff_id, weekday, starts_at, ends_at, valid_from)
select '20000000-0000-0000-0000-000000000005', weekday, '09:00', '20:00', '2026-01-01'
from generate_series(0, 6) as weekday;

-- ---------------------------------------------------------------------
-- Tenant B unipersonal: catálogo, clientes, productos y turnos de hoy
-- para probar el sistema completo con un solo profesional (que a la vez
-- es el dueño). El modelo no distingue "unipersonal" de "con equipo" --
-- es la misma tabla staff con una sola fila; nada le impide sumar más
-- profesionales el día de mañana.
-- ---------------------------------------------------------------------

insert into service_categories (id, tenant_id, name, sort) values
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Barbería', 1);

insert into services (id, tenant_id, category_id, name, description, price, buffer_after_min) values
  ('31000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Corte Clásico', 'Corte a tijera y máquina, incluye lavado.', 8500, 5),
  ('31000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Arreglo de Barba', 'Perfilado y afeitado prolijo.', 6500, 5),
  ('31000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Corte + Barba', 'Combo de corte y arreglo de barba.', 13500, 10);

insert into service_phases (service_id, position, kind, minutes) values
  ('31000000-0000-0000-0000-000000000005', 1, 'active', 30),
  ('31000000-0000-0000-0000-000000000006', 1, 'active', 20),
  ('31000000-0000-0000-0000-000000000007', 1, 'active', 45);

insert into staff_services (staff_id, service_id) values
  ('20000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000005'),
  ('20000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000006'),
  ('20000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000007');

insert into clients (id, tenant_id, full_name, phone_e164, email) values
  ('40000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'Federico Aguirre', '+5491133445566', 'fede.aguirre@gmail.com'),
  ('40000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000002', 'Bruno Cabrera', '+5491133445567', null),
  ('40000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', 'Ignacio Ferreyra', '+5491133445568', 'ignacio.ferreyra@gmail.com');

insert into products (id, tenant_id, name, price, category, sku, low_stock_threshold) values
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Cera para Peinar', 3800, 'Barbería', 'BC-CE-001', 5),
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', 'Aceite para Barba', 4500, 'Barbería', 'BC-AC-001', 5);

insert into stock_movements (product_id, qty, reason) values
  ('50000000-0000-0000-0000-000000000005', 15, 'Stock inicial'),
  ('50000000-0000-0000-0000-000000000006', 15, 'Stock inicial');

insert into commission_rules (id, tenant_id, category_id, type, value) values
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'percent', 100);

do $$
declare
  v_tenant uuid := '10000000-0000-0000-0000-000000000002';
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_tz constant text := 'America/Argentina/Buenos_Aires';
  v_martin uuid := '20000000-0000-0000-0000-000000000005';

  v_corte uuid := '31000000-0000-0000-0000-000000000005';
  v_barba uuid := '31000000-0000-0000-0000-000000000006';
  v_combo uuid := '31000000-0000-0000-0000-000000000007';

  v_appt_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  -- Turno 1: Federico, Corte Clásico, 10:00.
  v_appt_id := '70000000-0000-0000-0000-000000000008';
  v_starts := (v_today + time '10:00') at time zone v_tz;
  v_ends := (v_today + time '10:35') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000007', v_martin, v_starts, v_ends, 'confirmed', 'staff', 8500, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_corte, 'Corte Clásico', 8500);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_martin, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 2: Bruno, Corte + Barba, 11:00.
  v_appt_id := '70000000-0000-0000-0000-000000000009';
  v_starts := (v_today + time '11:00') at time zone v_tz;
  v_ends := (v_today + time '11:55') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000008', v_martin, v_starts, v_ends, 'confirmed', 'staff', 13500, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_combo, 'Corte + Barba', 13500);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_martin, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 3: Ignacio, Arreglo de Barba, 16:00.
  v_appt_id := '70000000-0000-0000-0000-000000000010';
  v_starts := (v_today + time '16:00') at time zone v_tz;
  v_ends := (v_today + time '16:25') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000009', v_martin, v_starts, v_ends, 'confirmed', 'staff', 6500, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_barba, 'Arreglo de Barba', 6500);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_martin, tstzrange(v_starts, v_ends, '[)'));
end $$;

-- ---------------------------------------------------------------------
-- Datos genéricos extra para probar Studio Lumière de punta a punta
-- (agenda, turnero público, caja, comisiones, reportes) sin tener que
-- cargar nada a mano. Todo lo que sigue vive en el tenant A.
-- ---------------------------------------------------------------------

-- Segunda pareja de servicios, en la categoría de barbería (la que ya
-- existía en el seed original quedaba sin ningún servicio real).
insert into services (id, tenant_id, category_id, name, description, price, buffer_after_min) values
  (
    '31000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002', 'Corte Clásico',
    'Corte a tijera y máquina, incluye lavado.', 8000, 5
  ),
  (
    '31000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002', 'Arreglo de Barba',
    'Perfilado y afeitado prolijo.', 6000, 5
  );

insert into service_phases (service_id, position, kind, minutes) values
  ('31000000-0000-0000-0000-000000000003', 1, 'active', 30),
  ('31000000-0000-0000-0000-000000000004', 1, 'active', 20);

insert into staff_services (staff_id, service_id) values
  -- Ana también atiende Limpieza Facial (en el seed original solo tenía Coloración).
  ('20000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000004');

insert into clients (id, tenant_id, full_name, phone_e164, email) values
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Martín Ibáñez', '+5491122334401', 'martin.ibanez@gmail.com'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Sofía Ledesma', '+5491122334402', null),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Rodrigo Paz', '+5491122334403', 'rodrigo.paz@gmail.com'),
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Valentina Suárez', '+5491122334404', null);

-- Productos para vender en caja junto con el servicio (sección 3.4/5.5).
insert into products (id, tenant_id, name, price, category, sku, low_stock_threshold) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Shampoo Reparador', 3000, 'Cuidado capilar', 'SH-001', 5),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Sérum Facial Hidratante', 5500, 'Cosmética facial', 'SF-001', 5),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Cera para Barba', 4200, 'Barbería', 'CB-001', 5),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Acondicionador Nutritivo', 3200, 'Cuidado capilar', 'AC-001', 5);

insert into stock_movements (product_id, qty, reason) values
  ('50000000-0000-0000-0000-000000000001', 25, 'Stock inicial'),
  ('50000000-0000-0000-0000-000000000002', 25, 'Stock inicial'),
  ('50000000-0000-0000-0000-000000000003', 25, 'Stock inicial'),
  ('50000000-0000-0000-0000-000000000004', 25, 'Stock inicial');

-- Comisiones por categoría (sección 5.5: servicio > categoría > profesional;
-- acá alcanza con categoría para que finalize_appointment tenga algo que
-- aplicar al cobrar cualquiera de los 4 servicios del catálogo).
insert into commission_rules (id, tenant_id, category_id, type, value) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'percent', 20),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'percent', 15);

-- Turnos de HOY (confirmados, listos para cobrar en /app/studio-lumiere/caja)
-- y un turno de AYER ya cobrado (para que Reportes tenga algo que mostrar).
-- Horarios calculados en vivo contra la fecha real de hoy, en hora local
-- de Buenos Aires, para que aparezcan en la agenda del día sin importar
-- cuándo se corra este seed.
do $$
declare
  v_tenant uuid := '10000000-0000-0000-0000-000000000001';
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_yesterday date := v_today - 1;
  v_tz constant text := 'America/Argentina/Buenos_Aires';

  -- staff
  v_lucia uuid := '20000000-0000-0000-0000-000000000001';
  v_ana uuid := '20000000-0000-0000-0000-000000000002';
  v_lucas uuid := '20000000-0000-0000-0000-000000000003';
  v_carolina uuid := '20000000-0000-0000-0000-000000000004';

  -- servicios
  v_facial uuid := '31000000-0000-0000-0000-000000000001';
  v_color uuid := '31000000-0000-0000-0000-000000000002';
  v_corte uuid := '31000000-0000-0000-0000-000000000003';
  v_barba uuid := '31000000-0000-0000-0000-000000000004';

  v_appt_id uuid;
  v_starts timestamptz;
  v_ends timestamptz;
begin
  -- Turno 1: Lucía + Camila Morales, Limpieza Facial, 10:00, sin seña.
  v_appt_id := '70000000-0000-0000-0000-000000000001';
  v_starts := (v_today + time '10:00') at time zone v_tz;
  v_ends := (v_today + time '10:50') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000001', v_lucia, v_starts, v_ends, 'confirmed', 'staff', 24000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_facial, 'Limpieza Facial Profunda', 24000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_lucia, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 2: Ana + Julieta Navarro, Coloración, 11:30, con seña de Mercado Pago ya pagada.
  v_appt_id := '70000000-0000-0000-0000-000000000002';
  v_starts := (v_today + time '11:30') at time zone v_tz;
  v_ends := (v_today + time '13:10') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000002', v_ana, v_starts, v_ends, 'confirmed', 'public', 32000, 16000, 16000);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_color, 'Coloración con Tiempo de Espera', 32000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_ana, tstzrange(v_starts, v_ends, '[)'));
  insert into payments (tenant_id, appointment_id, kind, method, amount, status, mp_payment_id)
  values (v_tenant, v_appt_id, 'deposit', 'mercadopago', 16000, 'approved', 'seed-mp-0001');

  -- Turno 3: Lucas + Martín Ibáñez, Corte Clásico, 13:00.
  v_appt_id := '70000000-0000-0000-0000-000000000003';
  v_starts := (v_today + time '13:00') at time zone v_tz;
  v_ends := (v_today + time '13:35') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000003', v_lucas, v_starts, v_ends, 'confirmed', 'staff', 8000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_corte, 'Corte Clásico', 8000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_lucas, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 4: Carolina + Sofía Ledesma, Arreglo de Barba, 13:45.
  v_appt_id := '70000000-0000-0000-0000-000000000004';
  v_starts := (v_today + time '13:45') at time zone v_tz;
  v_ends := (v_today + time '14:10') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000004', v_carolina, v_starts, v_ends, 'confirmed', 'staff', 6000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_barba, 'Arreglo de Barba', 6000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_carolina, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 5: Lucía + Rodrigo Paz, Limpieza Facial, 15:00.
  v_appt_id := '70000000-0000-0000-0000-000000000005';
  v_starts := (v_today + time '15:00') at time zone v_tz;
  v_ends := (v_today + time '15:50') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000005', v_lucia, v_starts, v_ends, 'confirmed', 'staff', 24000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_facial, 'Limpieza Facial Profunda', 24000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_lucia, tstzrange(v_starts, v_ends, '[)'));

  -- Turno 6: Lucas + Valentina Suárez, Corte Clásico, 16:00.
  v_appt_id := '70000000-0000-0000-0000-000000000006';
  v_starts := (v_today + time '16:00') at time zone v_tz;
  v_ends := (v_today + time '16:35') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000006', v_lucas, v_starts, v_ends, 'confirmed', 'staff', 8000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_corte, 'Corte Clásico', 8000);
  insert into appointment_segments (tenant_id, appointment_id, staff_id, period)
  values (v_tenant, v_appt_id, v_lucas, tstzrange(v_starts, v_ends, '[)'));

  -- Turno de AYER, ya cobrado (servicio + producto), para Reportes.
  v_appt_id := '70000000-0000-0000-0000-000000000007';
  v_starts := (v_yesterday + time '10:00') at time zone v_tz;
  v_ends := (v_yesterday + time '10:50') at time zone v_tz;
  insert into appointments (id, tenant_id, client_id, staff_id, starts_at, ends_at, status, source, total, deposit_required, deposit_paid)
  values (v_appt_id, v_tenant, '40000000-0000-0000-0000-000000000001', v_lucia, v_starts, v_ends, 'completed', 'staff', 27000, 0, 0);
  insert into appointment_items (appointment_id, service_id, name, price)
  values (v_appt_id, v_facial, 'Limpieza Facial Profunda', 24000);
  insert into sale_items (appointment_id, product_id, qty, unit_price)
  values (v_appt_id, '50000000-0000-0000-0000-000000000001', 1, 3000);
  insert into stock_movements (product_id, qty, reason, appointment_id)
  values ('50000000-0000-0000-0000-000000000001', -1, 'Venta en turno', v_appt_id);
  insert into payments (tenant_id, appointment_id, kind, method, amount, status)
  values (v_tenant, v_appt_id, 'balance', 'cash', 27000, 'approved');
  insert into commission_entries (appointment_id, staff_id, base_amount, amount)
  values (v_appt_id, v_lucia, 24000, 4800);
  insert into appointment_status_history (appointment_id, from_status, to_status)
  values (v_appt_id, 'confirmed', 'completed');
end $$;

-- =========================================================
-- Datos anuales demo — Barbería del Centro + Studio Lumière
-- Cubre: Jan–Aug 2026 (histórico, completed) +
--        Oct–Dic 2026 (futuro, confirmed)
-- Sep 2026 se omite: el seed base ya tiene datos de hoy.
-- cash_sessions se omite: opened_by requiere UUID de auth.users
-- que no existe hasta que el admin se registre.
-- =========================================================

-- Barbería del Centro: 20 clientes nuevos (IDs 10–29)
insert into clients (id, tenant_id, full_name, phone_e164, email) values
  ('40000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000002','Tomás Acosta',         '+5491155667710','tomas.acosta@gmail.com'),
  ('40000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000002','Matías Rodríguez',     '+5491155667711', null),
  ('40000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000002','Sebastián López',      '+5491155667712','sebas.lopez@hotmail.com'),
  ('40000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000002','Diego Herrera',        '+5491155667713', null),
  ('40000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000002','Gabriel Méndez',       '+5491155667714','gabriel.mendez@gmail.com'),
  ('40000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000002','Nicolás Castro',       '+5491155667715', null),
  ('40000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000002','Cristian Ortiz',       '+5491155667716','c.ortiz@gmail.com'),
  ('40000000-0000-0000-0000-000000000017','10000000-0000-0000-0000-000000000002','Pablo Jiménez',        '+5491155667717', null),
  ('40000000-0000-0000-0000-000000000018','10000000-0000-0000-0000-000000000002','Facundo Ramos',        '+5491155667718','facu.ramos@gmail.com'),
  ('40000000-0000-0000-0000-000000000019','10000000-0000-0000-0000-000000000002','Alejandro Reyes',      '+5491155667719', null),
  ('40000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000002','Emilio Vargas',        '+5491155667720','emilio.vargas@gmail.com'),
  ('40000000-0000-0000-0000-000000000021','10000000-0000-0000-0000-000000000002','Ricardo Flores',       '+5491155667721', null),
  ('40000000-0000-0000-0000-000000000022','10000000-0000-0000-0000-000000000002','Maximiliano Torres',   '+5491155667722','max.torres@gmail.com'),
  ('40000000-0000-0000-0000-000000000023','10000000-0000-0000-0000-000000000002','Leandro Gutiérrez',    '+5491155667723', null),
  ('40000000-0000-0000-0000-000000000024','10000000-0000-0000-0000-000000000002','Mariano Pereyra',      '+5491155667724','mariano.pereyra@gmail.com'),
  ('40000000-0000-0000-0000-000000000025','10000000-0000-0000-0000-000000000002','Claudio Álvarez',      '+5491155667725', null),
  ('40000000-0000-0000-0000-000000000026','10000000-0000-0000-0000-000000000002','Ángel Moreno',         '+5491155667726','angel.moreno@gmail.com'),
  ('40000000-0000-0000-0000-000000000027','10000000-0000-0000-0000-000000000002','Walter Navarro',       '+5491155667727', null),
  ('40000000-0000-0000-0000-000000000028','10000000-0000-0000-0000-000000000002','Esteban Cruz',         '+5491155667728','esteban.cruz@gmail.com'),
  ('40000000-0000-0000-0000-000000000029','10000000-0000-0000-0000-000000000002','Hernán Sosa',          '+5491155667729', null);

-- Studio Lumière: 20 clientes nuevos (IDs 30–49)
insert into clients (id, tenant_id, full_name, phone_e164, email) values
  ('40000000-0000-0000-0000-000000000030','10000000-0000-0000-0000-000000000001','Florencia Ramírez',    '+5491166778830','flor.ramirez@gmail.com'),
  ('40000000-0000-0000-0000-000000000031','10000000-0000-0000-0000-000000000001','Andrea Gómez',         '+5491166778831', null),
  ('40000000-0000-0000-0000-000000000032','10000000-0000-0000-0000-000000000001','Cecilia Herrera',      '+5491166778832','ceci.herrera@gmail.com'),
  ('40000000-0000-0000-0000-000000000033','10000000-0000-0000-0000-000000000001','Paola Díaz',           '+5491166778833', null),
  ('40000000-0000-0000-0000-000000000034','10000000-0000-0000-0000-000000000001','Natalia García',       '+5491166778834','natalia.garcia@hotmail.com'),
  ('40000000-0000-0000-0000-000000000035','10000000-0000-0000-0000-000000000001','Laura Fernández',      '+5491166778835', null),
  ('40000000-0000-0000-0000-000000000036','10000000-0000-0000-0000-000000000001','Silvana Torres',       '+5491166778836','silvana.torres@gmail.com'),
  ('40000000-0000-0000-0000-000000000037','10000000-0000-0000-0000-000000000001','Viviana Castro',       '+5491166778837', null),
  ('40000000-0000-0000-0000-000000000038','10000000-0000-0000-0000-000000000001','Lorena Méndez',        '+5491166778838','lorena.mendez@gmail.com'),
  ('40000000-0000-0000-0000-000000000039','10000000-0000-0000-0000-000000000001','Daniela Ortiz',        '+5491166778839', null),
  ('40000000-0000-0000-0000-000000000040','10000000-0000-0000-0000-000000000001','Patricia López',       '+5491166778840','patricia.lopez@gmail.com'),
  ('40000000-0000-0000-0000-000000000041','10000000-0000-0000-0000-000000000001','Alejandra Romero',     '+5491166778841', null),
  ('40000000-0000-0000-0000-000000000042','10000000-0000-0000-0000-000000000001','Marcela Ruiz',         '+5491166778842','marcela.ruiz@gmail.com'),
  ('40000000-0000-0000-0000-000000000043','10000000-0000-0000-0000-000000000001','Gabriela Sánchez',     '+5491166778843', null),
  ('40000000-0000-0000-0000-000000000044','10000000-0000-0000-0000-000000000001','Luciana Pérez',        '+5491166778844','luciana.perez@gmail.com'),
  ('40000000-0000-0000-0000-000000000045','10000000-0000-0000-0000-000000000001','Verónica Martínez',    '+5491166778845', null),
  ('40000000-0000-0000-0000-000000000046','10000000-0000-0000-0000-000000000001','Claudia Reyes',        '+5491166778846','claudia.reyes@hotmail.com'),
  ('40000000-0000-0000-0000-000000000047','10000000-0000-0000-0000-000000000001','Mónica Acosta',        '+5491166778847', null),
  ('40000000-0000-0000-0000-000000000048','10000000-0000-0000-0000-000000000001','Graciela Jiménez',     '+5491166778848','graciela.jimenez@gmail.com'),
  ('40000000-0000-0000-0000-000000000049','10000000-0000-0000-0000-000000000001','Norma Vargas',         '+5491166778849', null);

-- ── Barbería del Centro: histórico Jan-Aug 2026 ──────────
do $barb_hist$
declare
  v_tenant   constant uuid := '10000000-0000-0000-0000-000000000002';
  v_tz       constant text := 'America/Argentina/Buenos_Aires';
  v_martin   constant uuid := '20000000-0000-0000-0000-000000000005';
  v_clients  uuid[] := array[
    '40000000-0000-0000-0000-000000000007'::uuid,'40000000-0000-0000-0000-000000000008'::uuid,
    '40000000-0000-0000-0000-000000000009'::uuid,'40000000-0000-0000-0000-000000000010'::uuid,
    '40000000-0000-0000-0000-000000000011'::uuid,'40000000-0000-0000-0000-000000000012'::uuid,
    '40000000-0000-0000-0000-000000000013'::uuid,'40000000-0000-0000-0000-000000000014'::uuid,
    '40000000-0000-0000-0000-000000000015'::uuid,'40000000-0000-0000-0000-000000000016'::uuid,
    '40000000-0000-0000-0000-000000000017'::uuid,'40000000-0000-0000-0000-000000000018'::uuid,
    '40000000-0000-0000-0000-000000000019'::uuid,'40000000-0000-0000-0000-000000000020'::uuid,
    '40000000-0000-0000-0000-000000000021'::uuid,'40000000-0000-0000-0000-000000000022'::uuid,
    '40000000-0000-0000-0000-000000000023'::uuid,'40000000-0000-0000-0000-000000000024'::uuid,
    '40000000-0000-0000-0000-000000000025'::uuid,'40000000-0000-0000-0000-000000000026'::uuid,
    '40000000-0000-0000-0000-000000000027'::uuid,'40000000-0000-0000-0000-000000000028'::uuid,
    '40000000-0000-0000-0000-000000000029'::uuid
  ];
  v_svcs      uuid[]    := array[
    '31000000-0000-0000-0000-000000000005'::uuid,
    '31000000-0000-0000-0000-000000000006'::uuid,
    '31000000-0000-0000-0000-000000000007'::uuid
  ];
  v_svc_names text[]    := array['Corte Clásico','Arreglo de Barba','Corte + Barba'];
  v_prices    numeric[] := array[8500, 6500, 13500];
  v_durs      int[]     := array[35, 25, 55];
  v_slots     time[]    := array[
    '09:00'::time,'10:00'::time,'11:00'::time,'12:00'::time,
    '14:00'::time,'15:00'::time,'16:00'::time,'17:00'::time,'18:00'::time
  ];
  v_methods   text[]    := array['cash','cash','cash','transfer','mercadopago'];
  v_date date; v_dow int; v_off int; v_n_slots int; v_slot int;
  v_si int; v_ci int; v_mi int;
  v_starts timestamptz; v_ends timestamptz; v_appt uuid; v_stat text;
begin
  for v_date in
    select d::date from generate_series('2026-01-01'::date,'2026-08-31'::date,'1 day') d
  loop
    v_dow := extract(dow from v_date)::int;
    if v_dow = 0 then continue; end if;
    v_off     := (v_date - '2026-01-01'::date);
    v_n_slots := case v_dow when 6 then 9 when 5 then 8 when 1 then 6 else 7 end;
    for v_slot in 0..(v_n_slots - 1) loop
      v_si     := (v_off * 3 + v_slot) % 3 + 1;
      v_ci     := (v_off * 7 + v_slot) % 23 + 1;
      v_mi     := (v_off + v_slot) % 5 + 1;
      v_starts := (v_date + v_slots[v_slot + 1]) at time zone v_tz;
      v_ends   := v_starts + (v_durs[v_si] || ' minutes')::interval;
      v_stat   := case
        when (v_off * 9 + v_slot) % 12 = 0 then 'no_show'
        when (v_off * 9 + v_slot) % 25 = 0 then 'cancelled'
        else 'completed'
      end;
      v_appt := gen_random_uuid();
      insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
        status, source, total, deposit_required, deposit_paid)
      values(v_appt, v_tenant, v_clients[v_ci], v_martin,
        v_starts, v_ends, v_stat, 'staff', v_prices[v_si], 0, 0);
      insert into appointment_items(appointment_id, service_id, name, price)
      values(v_appt, v_svcs[v_si], v_svc_names[v_si], v_prices[v_si]);
      insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
      values(v_tenant, v_appt, v_martin, tstzrange(v_starts, v_ends, '[)'));
      if v_stat = 'completed' then
        insert into payments(tenant_id, appointment_id, kind, method, amount, status)
        values(v_tenant, v_appt, 'balance', v_methods[v_mi], v_prices[v_si], 'approved');
        insert into commission_entries(appointment_id, staff_id, base_amount, amount)
        values(v_appt, v_martin, v_prices[v_si], v_prices[v_si]);
      end if;
    end loop;
  end loop;
end $barb_hist$;

-- ── Barbería del Centro: futuro Oct-Dic 2026 ─────────────
do $barb_fut$
declare
  v_tenant  constant uuid := '10000000-0000-0000-0000-000000000002';
  v_tz      constant text := 'America/Argentina/Buenos_Aires';
  v_martin  constant uuid := '20000000-0000-0000-0000-000000000005';
  v_clients uuid[] := array[
    '40000000-0000-0000-0000-000000000007'::uuid,'40000000-0000-0000-0000-000000000008'::uuid,
    '40000000-0000-0000-0000-000000000009'::uuid,'40000000-0000-0000-0000-000000000010'::uuid,
    '40000000-0000-0000-0000-000000000011'::uuid,'40000000-0000-0000-0000-000000000012'::uuid,
    '40000000-0000-0000-0000-000000000013'::uuid,'40000000-0000-0000-0000-000000000014'::uuid,
    '40000000-0000-0000-0000-000000000015'::uuid,'40000000-0000-0000-0000-000000000016'::uuid,
    '40000000-0000-0000-0000-000000000017'::uuid,'40000000-0000-0000-0000-000000000018'::uuid,
    '40000000-0000-0000-0000-000000000019'::uuid,'40000000-0000-0000-0000-000000000020'::uuid,
    '40000000-0000-0000-0000-000000000021'::uuid,'40000000-0000-0000-0000-000000000022'::uuid,
    '40000000-0000-0000-0000-000000000023'::uuid,'40000000-0000-0000-0000-000000000024'::uuid,
    '40000000-0000-0000-0000-000000000025'::uuid,'40000000-0000-0000-0000-000000000026'::uuid,
    '40000000-0000-0000-0000-000000000027'::uuid,'40000000-0000-0000-0000-000000000028'::uuid,
    '40000000-0000-0000-0000-000000000029'::uuid
  ];
  v_svcs      uuid[]    := array['31000000-0000-0000-0000-000000000005'::uuid,'31000000-0000-0000-0000-000000000006'::uuid,'31000000-0000-0000-0000-000000000007'::uuid];
  v_svc_names text[]    := array['Corte Clásico','Arreglo de Barba','Corte + Barba'];
  v_prices    numeric[] := array[8500, 6500, 13500];
  v_durs      int[]     := array[35, 25, 55];
  v_slots     time[]    := array['09:00'::time,'10:00'::time,'11:00'::time,'12:00'::time,'14:00'::time,'15:00'::time,'16:00'::time,'17:00'::time];
  v_date date; v_dow int; v_off int; v_n_slots int; v_slot int; v_si int; v_ci int;
  v_starts timestamptz; v_ends timestamptz; v_appt uuid;
begin
  for v_date in
    select d::date from generate_series('2026-10-01'::date,'2026-12-31'::date,'1 day') d
  loop
    v_dow := extract(dow from v_date)::int;
    if v_dow = 0 then continue; end if;
    v_off := (v_date - '2026-10-01'::date);
    v_n_slots := case
      when extract(month from v_date) = 12 and v_dow in (5,6) then 8
      when v_dow = 6 then 7 when v_dow = 1 then 5 else 6
    end;
    for v_slot in 0..(v_n_slots - 1) loop
      v_si     := (v_off * 3 + v_slot) % 3 + 1;
      v_ci     := (v_off * 7 + v_slot) % 23 + 1;
      v_starts := (v_date + v_slots[v_slot + 1]) at time zone v_tz;
      v_ends   := v_starts + (v_durs[v_si] || ' minutes')::interval;
      v_appt   := gen_random_uuid();
      insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
        status, source, total, deposit_required, deposit_paid)
      values(v_appt, v_tenant, v_clients[v_ci], v_martin,
        v_starts, v_ends, 'confirmed', 'staff', v_prices[v_si], 0, 0);
      insert into appointment_items(appointment_id, service_id, name, price)
      values(v_appt, v_svcs[v_si], v_svc_names[v_si], v_prices[v_si]);
      insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
      values(v_tenant, v_appt, v_martin, tstzrange(v_starts, v_ends, '[)'));
    end loop;
  end loop;
end $barb_fut$;

-- ── Studio Lumière: histórico Jan-Aug 2026 ───────────────
do $studio_hist$
declare
  v_tenant   constant uuid := '10000000-0000-0000-0000-000000000001';
  v_tz       constant text := 'America/Argentina/Buenos_Aires';
  v_staff    uuid[] := array[
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000003'::uuid,
    '20000000-0000-0000-0000-000000000004'::uuid
  ];
  v_clients  uuid[] := array[
    '40000000-0000-0000-0000-000000000001'::uuid,'40000000-0000-0000-0000-000000000002'::uuid,
    '40000000-0000-0000-0000-000000000003'::uuid,'40000000-0000-0000-0000-000000000004'::uuid,
    '40000000-0000-0000-0000-000000000005'::uuid,'40000000-0000-0000-0000-000000000006'::uuid,
    '40000000-0000-0000-0000-000000000030'::uuid,'40000000-0000-0000-0000-000000000031'::uuid,
    '40000000-0000-0000-0000-000000000032'::uuid,'40000000-0000-0000-0000-000000000033'::uuid,
    '40000000-0000-0000-0000-000000000034'::uuid,'40000000-0000-0000-0000-000000000035'::uuid,
    '40000000-0000-0000-0000-000000000036'::uuid,'40000000-0000-0000-0000-000000000037'::uuid,
    '40000000-0000-0000-0000-000000000038'::uuid,'40000000-0000-0000-0000-000000000039'::uuid,
    '40000000-0000-0000-0000-000000000040'::uuid,'40000000-0000-0000-0000-000000000041'::uuid,
    '40000000-0000-0000-0000-000000000042'::uuid,'40000000-0000-0000-0000-000000000043'::uuid,
    '40000000-0000-0000-0000-000000000044'::uuid,'40000000-0000-0000-0000-000000000045'::uuid,
    '40000000-0000-0000-0000-000000000046'::uuid,'40000000-0000-0000-0000-000000000047'::uuid,
    '40000000-0000-0000-0000-000000000048'::uuid,'40000000-0000-0000-0000-000000000049'::uuid
  ];
  -- staff 1,2 (Lucía/Ana): facial — slots 120-min (coloración 100-min cabe sin overlap)
  v_svcs_f  uuid[]    := array['31000000-0000-0000-0000-000000000001'::uuid,'31000000-0000-0000-0000-000000000002'::uuid];
  v_names_f text[]    := array['Limpieza Facial Profunda','Coloración con Tiempo de Espera'];
  v_price_f numeric[] := array[24000, 32000];
  v_dur_f   int[]     := array[50, 100];
  v_slots_f time[]    := array['09:00'::time,'11:00'::time,'13:00'::time,'15:00'::time,'17:00'::time];
  -- staff 3,4 (Lucas/Carolina): pelo — slots 60-min
  v_svcs_p  uuid[]    := array['31000000-0000-0000-0000-000000000003'::uuid,'31000000-0000-0000-0000-000000000004'::uuid];
  v_names_p text[]    := array['Corte Clásico','Arreglo de Barba'];
  v_price_p numeric[] := array[8000, 6000];
  v_dur_p   int[]     := array[35, 25];
  v_slots_p time[]    := array['09:00'::time,'10:00'::time,'11:00'::time,'12:00'::time,'14:00'::time,'15:00'::time,'16:00'::time,'17:00'::time];
  v_methods text[]    := array['cash','cash','transfer','mercadopago','cash'];
  v_date date; v_dow int; v_off int;
  v_sid int; v_si int; v_ci int; v_mi int; v_n_slots int; v_slot int;
  v_starts timestamptz; v_ends timestamptz; v_appt uuid;
  v_price numeric; v_stat text; v_comm_pct numeric;
begin
  for v_date in
    select d::date from generate_series('2026-01-01'::date,'2026-08-31'::date,'1 day') d
  loop
    v_dow := extract(dow from v_date)::int;
    if v_dow = 0 then continue; end if;
    v_off := (v_date - '2026-01-01'::date);
    for v_sid in 1..4 loop
      if v_sid <= 2 then
        v_n_slots := case v_dow when 6 then 4 when 1 then 3 else 4 end;
      else
        v_n_slots := case v_dow when 6 then 7 when 5 then 7 when 1 then 5 else 6 end;
      end if;
      for v_slot in 0..(v_n_slots - 1) loop
        v_ci   := (v_off * 11 + v_sid * 5 + v_slot) % 26 + 1;
        v_mi   := (v_off + v_sid + v_slot) % 5 + 1;
        v_stat := case
          when (v_off * 13 + v_sid * 7 + v_slot) % 11 = 0 then 'no_show'
          when (v_off * 13 + v_sid * 7 + v_slot) % 27 = 0 then 'cancelled'
          else 'completed'
        end;
        if v_sid <= 2 then
          v_si     := case when (v_off / 5 + v_slot) % 3 = 0 then 2 else 1 end;
          v_starts := (v_date + v_slots_f[v_slot + 1]) at time zone v_tz;
          v_ends   := v_starts + (v_dur_f[v_si] || ' minutes')::interval;
          v_price  := v_price_f[v_si];
          v_appt   := gen_random_uuid();
          insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
            status, source, total, deposit_required, deposit_paid)
          values(v_appt, v_tenant, v_clients[v_ci], v_staff[v_sid],
            v_starts, v_ends, v_stat, 'staff', v_price, 0, 0);
          insert into appointment_items(appointment_id, service_id, name, price)
          values(v_appt, v_svcs_f[v_si], v_names_f[v_si], v_price);
          insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
          values(v_tenant, v_appt, v_staff[v_sid], tstzrange(v_starts, v_ends, '[)'));
          if v_stat = 'completed' then
            insert into payments(tenant_id, appointment_id, kind, method, amount, status)
            values(v_tenant, v_appt, 'balance', v_methods[v_mi], v_price, 'approved');
            v_comm_pct := 0.20;
            insert into commission_entries(appointment_id, staff_id, base_amount, amount)
            values(v_appt, v_staff[v_sid], v_price, round(v_price * v_comm_pct));
          end if;
        else
          v_si     := case when (v_off + v_sid + v_slot) % 3 = 0 then 2 else 1 end;
          v_starts := (v_date + v_slots_p[v_slot + 1]) at time zone v_tz;
          v_ends   := v_starts + (v_dur_p[v_si] || ' minutes')::interval;
          v_price  := v_price_p[v_si];
          v_appt   := gen_random_uuid();
          insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
            status, source, total, deposit_required, deposit_paid)
          values(v_appt, v_tenant, v_clients[v_ci], v_staff[v_sid],
            v_starts, v_ends, v_stat, 'staff', v_price, 0, 0);
          insert into appointment_items(appointment_id, service_id, name, price)
          values(v_appt, v_svcs_p[v_si], v_names_p[v_si], v_price);
          insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
          values(v_tenant, v_appt, v_staff[v_sid], tstzrange(v_starts, v_ends, '[)'));
          if v_stat = 'completed' then
            insert into payments(tenant_id, appointment_id, kind, method, amount, status)
            values(v_tenant, v_appt, 'balance', v_methods[v_mi], v_price, 'approved');
            v_comm_pct := 0.15;
            insert into commission_entries(appointment_id, staff_id, base_amount, amount)
            values(v_appt, v_staff[v_sid], v_price, round(v_price * v_comm_pct));
          end if;
        end if;
      end loop;
    end loop;
  end loop;
end $studio_hist$;

-- ── Studio Lumière: futuro Oct-Dic 2026 ──────────────────
do $studio_fut$
declare
  v_tenant   constant uuid := '10000000-0000-0000-0000-000000000001';
  v_tz       constant text := 'America/Argentina/Buenos_Aires';
  v_staff    uuid[] := array[
    '20000000-0000-0000-0000-000000000001'::uuid,'20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000003'::uuid,'20000000-0000-0000-0000-000000000004'::uuid
  ];
  v_clients  uuid[] := array[
    '40000000-0000-0000-0000-000000000001'::uuid,'40000000-0000-0000-0000-000000000002'::uuid,
    '40000000-0000-0000-0000-000000000003'::uuid,'40000000-0000-0000-0000-000000000004'::uuid,
    '40000000-0000-0000-0000-000000000005'::uuid,'40000000-0000-0000-0000-000000000006'::uuid,
    '40000000-0000-0000-0000-000000000030'::uuid,'40000000-0000-0000-0000-000000000031'::uuid,
    '40000000-0000-0000-0000-000000000032'::uuid,'40000000-0000-0000-0000-000000000033'::uuid,
    '40000000-0000-0000-0000-000000000034'::uuid,'40000000-0000-0000-0000-000000000035'::uuid,
    '40000000-0000-0000-0000-000000000036'::uuid,'40000000-0000-0000-0000-000000000037'::uuid,
    '40000000-0000-0000-0000-000000000038'::uuid,'40000000-0000-0000-0000-000000000039'::uuid,
    '40000000-0000-0000-0000-000000000040'::uuid,'40000000-0000-0000-0000-000000000041'::uuid,
    '40000000-0000-0000-0000-000000000042'::uuid,'40000000-0000-0000-0000-000000000043'::uuid,
    '40000000-0000-0000-0000-000000000044'::uuid,'40000000-0000-0000-0000-000000000045'::uuid,
    '40000000-0000-0000-0000-000000000046'::uuid,'40000000-0000-0000-0000-000000000047'::uuid,
    '40000000-0000-0000-0000-000000000048'::uuid,'40000000-0000-0000-0000-000000000049'::uuid
  ];
  v_svcs_f  uuid[]    := array['31000000-0000-0000-0000-000000000001'::uuid,'31000000-0000-0000-0000-000000000002'::uuid];
  v_names_f text[]    := array['Limpieza Facial Profunda','Coloración con Tiempo de Espera'];
  v_price_f numeric[] := array[24000, 32000];
  v_dur_f   int[]     := array[50, 100];
  v_slots_f time[]    := array['09:00'::time,'11:00'::time,'13:00'::time,'15:00'::time,'17:00'::time];
  v_svcs_p  uuid[]    := array['31000000-0000-0000-0000-000000000003'::uuid,'31000000-0000-0000-0000-000000000004'::uuid];
  v_names_p text[]    := array['Corte Clásico','Arreglo de Barba'];
  v_price_p numeric[] := array[8000, 6000];
  v_dur_p   int[]     := array[35, 25];
  v_slots_p time[]    := array['09:00'::time,'10:00'::time,'11:00'::time,'12:00'::time,'14:00'::time,'15:00'::time,'16:00'::time,'17:00'::time];
  v_date date; v_dow int; v_off int;
  v_sid int; v_si int; v_ci int; v_n_slots int; v_slot int;
  v_starts timestamptz; v_ends timestamptz; v_appt uuid; v_price numeric;
begin
  for v_date in
    select d::date from generate_series('2026-10-01'::date,'2026-12-31'::date,'1 day') d
  loop
    v_dow := extract(dow from v_date)::int;
    if v_dow = 0 then continue; end if;
    v_off := (v_date - '2026-10-01'::date);
    for v_sid in 1..4 loop
      if v_sid <= 2 then
        v_n_slots := case
          when extract(month from v_date)=12 and v_dow in(5,6) then 5
          when v_dow=6 then 4 when v_dow=1 then 3 else 4
        end;
      else
        v_n_slots := case
          when extract(month from v_date)=12 and v_dow in(5,6) then 8
          when v_dow=6 then 7 when v_dow=1 then 5 else 6
        end;
      end if;
      for v_slot in 0..(v_n_slots - 1) loop
        v_ci   := (v_off * 11 + v_sid * 5 + v_slot) % 26 + 1;
        v_appt := gen_random_uuid();
        if v_sid <= 2 then
          v_si     := case when (v_off/5 + v_slot) % 3 = 0 then 2 else 1 end;
          v_starts := (v_date + v_slots_f[v_slot + 1]) at time zone v_tz;
          v_ends   := v_starts + (v_dur_f[v_si] || ' minutes')::interval;
          v_price  := v_price_f[v_si];
          insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
            status, source, total, deposit_required, deposit_paid)
          values(v_appt, v_tenant, v_clients[v_ci], v_staff[v_sid],
            v_starts, v_ends, 'confirmed', 'staff', v_price, 0, 0);
          insert into appointment_items(appointment_id, service_id, name, price)
          values(v_appt, v_svcs_f[v_si], v_names_f[v_si], v_price);
          insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
          values(v_tenant, v_appt, v_staff[v_sid], tstzrange(v_starts, v_ends, '[)'));
        else
          v_si     := case when (v_off + v_sid + v_slot) % 3 = 0 then 2 else 1 end;
          v_starts := (v_date + v_slots_p[v_slot + 1]) at time zone v_tz;
          v_ends   := v_starts + (v_dur_p[v_si] || ' minutes')::interval;
          v_price  := v_price_p[v_si];
          insert into appointments(id, tenant_id, client_id, staff_id, starts_at, ends_at,
            status, source, total, deposit_required, deposit_paid)
          values(v_appt, v_tenant, v_clients[v_ci], v_staff[v_sid],
            v_starts, v_ends, 'confirmed', 'staff', v_price, 0, 0);
          insert into appointment_items(appointment_id, service_id, name, price)
          values(v_appt, v_svcs_p[v_si], v_names_p[v_si], v_price);
          insert into appointment_segments(tenant_id, appointment_id, staff_id, period)
          values(v_tenant, v_appt, v_staff[v_sid], tstzrange(v_starts, v_ends, '[)'));
        end if;
      end loop;
    end loop;
  end loop;
end $studio_fut$;
