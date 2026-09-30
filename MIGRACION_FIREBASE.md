# Estado de migración a Firebase

## Ya migrado a Firebase/Firestore

- Autenticación, sesiones y onboarding.
- Tenant, membresías, panel privado y cierre de sesión.
- Landing y redirección `/` a `/landing`.
- Servicios, clientes, staff, configuración, caja, dashboard y reportes.
- Turnero público, hold transaccional de diez minutos, reserva y “Mi turno”.
- Recordatorios, outbox y plataforma.
- Agenda diaria: lectura de profesionales y turnos desde Firestore.

## Pendiente de reemplazo Supabase

Las referencias restantes son código heredado de Agenda y helpers SQL:

- Agenda: detalle, alta manual, reprogramación, semana y mes.
- Helpers: `availability`, `agenda-month`, `tenant`, `platform`, notificaciones y tipos SQL.
- Adaptadores Supabase que se eliminarán cuando no queden importaciones.

## Criterio de despliegue

No se creará el vhost ni proceso PM2 hasta que `rg -l "supabase|Supabase" src` no liste rutas de producción y pasen `npm run typecheck`, `npm test` y `npm run build`.

## Infraestructura prevista

- Dominio: `turn.justcreate.com.ar`
- PM2: `turncreate`
- Puerto local: `3011`
- Firebase: `turncreate-prod`, Firestore en Northern Virginia (`us-east4`).
