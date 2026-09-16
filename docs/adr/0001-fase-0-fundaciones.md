# 0001. Fase 0: arrancar 100% local, cuentas en la nube como paso manual

Fecha: 2026-09-16

## Contexto

El plan maestro define la Fase 0 (semanas 1-2) como: repo, CI, Vercel y
Supabase staging/producción, Auth email + Google, tablas 3.1 a 3.3, helpers
de RLS, pgTAP, Sentry, shell de la app con selector de local.

Construir eso completo requiere crear y configurar cuentas externas: GitHub
(remoto), Supabase (dos proyectos en la nube), Vercel, Sentry, un client de
Google OAuth, y más adelante Mercado Pago, Meta WhatsApp Business y Brevo.
Ninguna de esas se puede crear de forma autónoma — cada una implica una
decisión (nombre de org, plan pago, verificación de identidad/negocio) que
le corresponde a Juan.

## Decisión

Arrancar la Fase 0 100% local:

- Repo git local (sin remoto todavía).
- Supabase local vía Docker/CLI en vez de proyectos en la nube.
- Auth funcional solo por email (Google OAuth necesita un client id/secret
  real de Google Cloud Console).
- Sentry, número de WhatsApp Business, Mercado Pago y Brevo quedan fuera de
  esta pasada — ver `docs/checklist-cuentas-externas.md`.

## Consecuencias

- Todo lo construido ahora es real y corre de punta a punta en
  `localhost:3000` + Supabase local, sin depender de que existan cuentas en
  la nube.
- El criterio de "terminado" de la Fase 0 ("usuarios de dos locales no se
  ven entre sí") se verifica con pgTAP contra la base local
  (`supabase/tests/database/tenant_isolation.test.sql`).
- Cuando Juan cree las cuentas de la checklist, conectar Vercel + Supabase
  en la nube es enlazar variables de entorno y hacer push de las
  migraciones ya escritas — no hay que rediseñar nada.
