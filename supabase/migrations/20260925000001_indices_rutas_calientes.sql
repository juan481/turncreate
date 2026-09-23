-- Índices compuestos para las consultas más frecuentes. Hasta ahora estas
-- tablas solo tenían índice por tenant_id solo, así que Postgres filtraba
-- por fecha recorriendo todas las filas del local.

-- Agenda día/semana/mes: siempre tenant_id + rango de starts_at.
create index appointments_tenant_id_starts_at_idx
  on appointments (tenant_id, starts_at);

-- Reportes: facturación del mes y de los 6 meses previos.
create index payments_tenant_id_status_created_at_idx
  on payments (tenant_id, status, created_at);

-- Reportes: clientes nuevos del mes.
create index clients_tenant_id_created_at_idx
  on clients (tenant_id, created_at);

-- has_role() corre en cada policy de RLS, o sea una vez por fila evaluada.
-- Este índice cubre la consulta entera sin tocar la tabla.
create index tenant_members_user_id_tenant_id_status_idx
  on tenant_members (user_id, tenant_id, status);
