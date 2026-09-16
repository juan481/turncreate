-- pgcrypto: gen_random_uuid() para todos los id de las tablas.
create extension if not exists pgcrypto;

-- btree_gist: la necesita appointment_segments en la Fase 1
-- (EXCLUDE USING gist para bloquear doble reserva, sección 5.2 del plan).
-- Se habilita ahora para no depender de otra migración más adelante.
create extension if not exists btree_gist;
