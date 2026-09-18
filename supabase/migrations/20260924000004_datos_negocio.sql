-- Pantalla de configuración del negocio (sección 3.2): dirección y redes
-- sociales para el turnero público y la ficha del local -- no existía
-- ningún campo para esto todavía.
alter table tenants
  add column address text,
  add column instagram_url text,
  add column whatsapp_number text;
